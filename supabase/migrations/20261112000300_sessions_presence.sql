-- =========================================================
-- Phase 3: study_sessions / enter_room / leave_room / Realtime RLS
-- 在室状態（誰が今いるか・今やっていること・集中/休憩/離席）は DB に書かず、
-- Realtime Presence で管理する。DB に書くのは入室・退室・ハートビートだけ。
-- =========================================================

create table public.study_sessions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  task         text not null check (char_length(btrim(task)) between 1 and 60),
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at     timestamptz,
  -- 退室時点のポモドーロ完了回数（タイマーを後からやり直しても記録が変わらないよう保存する）
  pomodoros    int not null default 0 check (pomodoros >= 0),
  check (ended_at is null or ended_at >= started_at)
);

comment on column public.study_sessions.pomodoros is '退室時に計算したポモドーロ完了回数';

-- 1ユーザーにつき未終了セッションは1つだけ
create unique index study_sessions_one_open_per_user
  on public.study_sessions (user_id) where ended_at is null;
create index study_sessions_room_open
  on public.study_sessions (room_id) where ended_at is null;
create index study_sessions_user_started
  on public.study_sessions (user_id, started_at desc);

alter table public.study_sessions enable row level security;

-- 自分のセッションだけ読める。書き込み用のポリシーは作らない（RPC 経由のみ）
create policy "study_sessions: read own"
  on public.study_sessions for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.study_sessions from anon, authenticated;
grant select on public.study_sessions to authenticated;

-- ---------------------------------------------------------
-- 計算用の関数
-- ---------------------------------------------------------
create or replace function public.session_minutes(p_started timestamptz, p_ended timestamptz)
returns int
language sql
immutable
set search_path = public
as $$
  select greatest(0, floor(extract(epoch from (p_ended - p_started)) / 60))::int;
$$;

-- [p_from, p_to] の間に「集中フェーズの終わり」が何回来たか。
-- 集中が終わる時刻は t0 + k*(集中+休憩) + 集中（k = 0, 1, 2, ...）
create or replace function public.count_pomodoros(
  p_timer_started_at timestamptz,
  p_focus_minutes int,
  p_break_minutes int,
  p_from timestamptz,
  p_to timestamptz
)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when p_timer_started_at is null or p_to <= p_from then 0
    else greatest(0,
      floor((extract(epoch from p_to - p_timer_started_at) - p_focus_minutes * 60)
            / ((p_focus_minutes + p_break_minutes) * 60))::int
      - greatest(0,
          floor((extract(epoch from p_from - p_timer_started_at) - p_focus_minutes * 60)
                / ((p_focus_minutes + p_break_minutes) * 60))::int + 1)
      + 1)
  end;
$$;

-- セッションを閉じる内部関数（RPC からのみ呼ぶ。クライアントからは呼べない）
create or replace function public.close_session_internal(p_session_id uuid, p_ended_at timestamptz)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
  v_room    public.rooms;
  v_end     timestamptz;
begin
  select * into v_session from public.study_sessions
  where id = p_session_id and ended_at is null
  for update;
  if not found then
    return null;
  end if;

  select * into v_room from public.rooms where id = v_session.room_id;
  v_end := greatest(p_ended_at, v_session.started_at);

  update public.study_sessions
  set ended_at  = v_end,
      pomodoros = case when v_room.timer_mode = 'pomodoro'
                       then public.count_pomodoros(v_room.timer_started_at, v_room.focus_minutes,
                                                   v_room.break_minutes, v_session.started_at, v_end)
                       else 0 end
  where id = v_session.id
  returning * into v_session;

  return v_session;
end;
$$;

revoke execute on function public.close_session_internal(uuid, timestamptz) from public, anon, authenticated;

-- 同じユーザーの入室・退室を直列化する（複数タブで同時に押した場合など）
create or replace function public.lock_user(p_user_id uuid)
returns void
language sql
volatile
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtextextended(p_user_id::text, 42));
$$;

revoke execute on function public.lock_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 入室 RPC
-- ロックの順番は必ず「ユーザーの advisory lock → 部屋の行」にしてデッドロックを防ぐ。
-- 戻り値: { status: 'entered', session_id, resumed } | { status: 'pending' }
-- ---------------------------------------------------------
create or replace function public.enter_room(
  p_room_id uuid,
  p_task text,
  p_invite_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_task       text := btrim(coalesce(p_task, ''));
  v_room       public.rooms;
  v_status     public.member_status;
  v_allowed    boolean;
  v_open       public.study_sessions;
  v_count      int;
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_task) not between 1 and 60 then
    raise exception 'invalid_task';
  end if;

  perform public.lock_user(v_uid);

  -- 部屋の行をロック。同時入室があっても、定員チェックは1人ずつ順番に行われる
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if v_room.closed_at is not null then
    raise exception 'room_closed';
  end if;
  if exists (select 1 from public.room_bans where room_id = p_room_id and user_id = v_uid) then
    raise exception 'banned';
  end if;

  select status into v_status from public.room_members
  where room_id = p_room_id and user_id = v_uid;

  -- v_status / p_invite_code は NULL になり得る。NULL のまま評価すると `not v_allowed` も
  -- NULL になって判定をすり抜けるので、必ず coalesce で false に倒す
  v_allowed := coalesce(
       v_room.owner_id = v_uid
    or v_status = 'active'
    or v_room.visibility = 'public'
    or (v_room.visibility = 'unlisted' and p_invite_code = v_room.invite_code),
    false);

  if not v_allowed then
    if v_room.visibility = 'approval' then
      -- 承認制：申請を登録して終了（例外にすると申請もロールバックされるので戻り値で返す）
      insert into public.room_members (room_id, user_id, role, status)
      values (p_room_id, v_uid, 'member', 'pending')
      on conflict (room_id, user_id) do nothing;
      return jsonb_build_object('status', 'pending');
    end if;
    raise exception 'invite_required';
  end if;

  select * into v_open from public.study_sessions
  where user_id = v_uid and ended_at is null;

  -- 同じ部屋に入り直した（リロード・別タブ）→ 既存セッションを続ける
  if v_open.id is not null and v_open.room_id = p_room_id then
    update public.study_sessions set task = v_task, last_seen_at = now() where id = v_open.id;
    update public.room_members set last_entered_at = now()
    where room_id = p_room_id and user_id = v_uid;
    return jsonb_build_object('status', 'entered', 'session_id', v_open.id, 'resumed', true);
  end if;

  select count(*) into v_count from public.study_sessions
  where room_id = p_room_id and ended_at is null;
  if v_count >= v_room.capacity then
    raise exception 'room_full';
  end if;

  -- 別の部屋に入りっぱなしなら閉じる
  -- （その部屋が一時部屋で空になった場合は、毎分の cron が閉じる。ここで別の部屋の行を
  --   ロックするとデッドロックの原因になるため）
  if v_open.id is not null then
    perform public.close_session_internal(v_open.id, now());
  end if;

  insert into public.room_members (room_id, user_id, role, status, last_entered_at)
  values (p_room_id, v_uid, 'member', 'active', now())
  on conflict (room_id, user_id) do update
    set status = 'active', last_entered_at = now();

  insert into public.study_sessions (room_id, user_id, task)
  values (p_room_id, v_uid, v_task)
  returning id into v_session_id;

  return jsonb_build_object('status', 'entered', 'session_id', v_session_id, 'resumed', false);
end;
$$;

revoke execute on function public.enter_room(uuid, text, text) from public, anon;
grant execute on function public.enter_room(uuid, text, text) to authenticated;

-- ---------------------------------------------------------
-- 退室 RPC
-- 戻り値: { session_id, room_id, minutes, pomodoros }
-- 投稿は退室画面で「ひとこと」を書いてから create_post で行う（フェーズ4）
-- ---------------------------------------------------------
create or replace function public.leave_room()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_open    public.study_sessions;
  v_closed  public.study_sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform public.lock_user(v_uid);

  select * into v_open from public.study_sessions
  where user_id = v_uid and ended_at is null;
  if not found then
    raise exception 'no_active_session';
  end if;

  -- 入室処理と同じ順番で部屋をロック（一時部屋を閉じる判定と入室が競合しないように）
  perform 1 from public.rooms where id = v_open.room_id for update;

  v_closed := public.close_session_internal(v_open.id, now());

  -- 一時部屋で最後の1人だったら閉じる
  update public.rooms
  set closed_at = now()
  where id = v_open.room_id
    and not is_persistent
    and closed_at is null
    and not exists (
      select 1 from public.study_sessions where room_id = v_open.room_id and ended_at is null
    );

  return jsonb_build_object(
    'session_id', v_closed.id,
    'room_id',    v_closed.room_id,
    'minutes',    public.session_minutes(v_closed.started_at, v_closed.ended_at),
    'pomodoros',  v_closed.pomodoros
  );
end;
$$;

revoke execute on function public.leave_room() from public, anon;
grant execute on function public.leave_room() to authenticated;

-- ---------------------------------------------------------
-- ロビー用：在室人数付きの部屋一覧
-- 普通のビューにすると限定部屋の人数まで見えてしまい、security_invoker にすると
-- 他人のセッションが RLS で見えず 0 人になる。そのため、閲覧してよい部屋だけを返す
-- security definer 関数にする。
-- ---------------------------------------------------------
create or replace function public.list_public_rooms(
  p_query text default null,
  p_tag text default null,
  p_limit int default 60
)
returns table (
  id uuid, name text, icon text, tags text[], visibility public.room_visibility,
  capacity int, timer_mode public.timer_mode, focus_minutes int, break_minutes int,
  timer_started_at timestamptz, is_persistent boolean, active_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select nullif(btrim(p_query), '') as text,
           nullif(btrim(p_tag), '') as tag
  ), pattern as (
    -- LIKE のワイルドカードをエスケープ
    select '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%' as p, q.tag
    from q
  )
  select r.id, r.name, r.icon, r.tags, r.visibility, r.capacity, r.timer_mode,
         r.focus_minutes, r.break_minutes, r.timer_started_at, r.is_persistent,
         (select count(*) from public.study_sessions s
           where s.room_id = r.id and s.ended_at is null)::int as active_count
  from public.rooms r, pattern
  where auth.uid() is not null
    and r.visibility = 'public'
    and r.closed_at is null
    and (pattern.p is null or r.name ilike pattern.p or r.description ilike pattern.p)
    and (pattern.tag is null or pattern.tag = any (r.tags))
  order by active_count desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;

create or replace function public.list_my_rooms(p_limit int default 12)
returns table (
  id uuid, name text, icon text, tags text[], visibility public.room_visibility,
  capacity int, timer_mode public.timer_mode, focus_minutes int, break_minutes int,
  timer_started_at timestamptz, is_persistent boolean, active_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name, r.icon, r.tags, r.visibility, r.capacity, r.timer_mode,
         r.focus_minutes, r.break_minutes, r.timer_started_at, r.is_persistent,
         (select count(*) from public.study_sessions s
           where s.room_id = r.id and s.ended_at is null)::int as active_count
  from public.room_members m
  join public.rooms r on r.id = m.room_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and r.closed_at is null
    and not exists (select 1 from public.room_bans b where b.room_id = r.id and b.user_id = m.user_id)
  order by coalesce(m.last_entered_at, m.joined_at) desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke execute on function public.list_public_rooms(text, text, int), public.list_my_rooms(int) from public, anon;
grant execute on function public.list_public_rooms(text, text, int), public.list_my_rooms(int) to authenticated;

-- ---------------------------------------------------------
-- 入室前画面用：部屋の情報と在室者
-- 入室前のユーザーは Realtime（Presence）を購読できない（RLS で在室者だけに制限している）
-- ので、在室者は未終了セッションから返す。
-- ---------------------------------------------------------
create or replace function public.get_room_preview(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_room   public.rooms;
  v_status public.member_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    return null;
  end if;

  select status into v_status from public.room_members
  where room_id = p_room_id and user_id = v_uid;

  -- 閲覧条件は rooms の RLS と同じ（限定部屋の招待URLからの取得はフェーズ8で追加）
  if not coalesce(v_room.visibility = 'public' or v_room.owner_id = v_uid or v_status = 'active', false) then
    return null;
  end if;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'owner_id', v_room.owner_id, 'name', v_room.name,
      'description', v_room.description, 'icon', v_room.icon, 'tags', to_jsonb(v_room.tags),
      'visibility', v_room.visibility, 'capacity', v_room.capacity,
      'timer_mode', v_room.timer_mode, 'focus_minutes', v_room.focus_minutes,
      'break_minutes', v_room.break_minutes, 'timer_started_at', v_room.timer_started_at,
      'is_persistent', v_room.is_persistent, 'closed_at', v_room.closed_at,
      'active_count', (select count(*) from public.study_sessions
                       where room_id = v_room.id and ended_at is null)
    ),
    'occupants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', s.user_id, 'display_name', p.display_name, 'started_at', s.started_at)
             order by s.started_at)
      from public.study_sessions s
      join public.profiles p on p.id = s.user_id
      where s.room_id = v_room.id and s.ended_at is null
    ), '[]'::jsonb),
    'is_member', coalesce(v_status = 'active', false),
    'is_banned', exists (select 1 from public.room_bans where room_id = v_room.id and user_id = v_uid)
  );
end;
$$;

revoke execute on function public.get_room_preview(uuid) from public, anon;
grant execute on function public.get_room_preview(uuid) to authenticated;

-- ---------------------------------------------------------
-- Realtime：private channel `room:{room_id}` は、その部屋に未終了セッションがある人だけ
-- 送受信できる（Presence と Broadcast の両方）
-- ---------------------------------------------------------
create or replace function public.has_open_session_in_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if p_topic is null
     or p_topic !~ '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_room_id := substr(p_topic, 6)::uuid;
  return exists (
    select 1 from public.study_sessions
    where room_id = v_room_id and user_id = auth.uid() and ended_at is null
  );
end;
$$;

revoke execute on function public.has_open_session_in_topic(text) from public, anon;
grant execute on function public.has_open_session_in_topic(text) to authenticated;

create policy "room channel: members can receive"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.has_open_session_in_topic((select realtime.topic()))
  );

create policy "room channel: members can send"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.has_open_session_in_topic((select realtime.topic()))
  );
