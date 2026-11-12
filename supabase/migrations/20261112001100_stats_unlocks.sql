-- =========================================================
-- Phase 12: プロフィールの統計と成長要素（アイテムの解放）
-- 日付の区切りは日本時間。週は月曜始まり。
-- セッションは「入室した日」の学習として数える（日をまたいでも分けない）
-- =========================================================

-- どのセッションで解放したか（退室画面で「解放！」の演出をするため）
alter table public.unlocks
  add column session_id uuid references public.study_sessions (id) on delete set null;

create or replace function public.jst_date(p_ts timestamptz)
returns date
language sql
immutable
set search_path = public
as $$
  select (p_ts at time zone 'Asia/Tokyo')::date;
$$;

-- 連続日数：今日（まだ勉強していなければ昨日）からさかのぼって、1分以上勉強した日が続いている日数
create or replace function public.current_streak(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select distinct public.jst_date(started_at) as d
    from public.study_sessions
    where user_id = p_user_id and ended_at is not null
      and public.session_minutes(started_at, ended_at) >= 1
  ),
  anchor as (
    select case
             when exists (select 1 from days where d = public.jst_date(now())) then public.jst_date(now())
             when exists (select 1 from days where d = public.jst_date(now()) - 1) then public.jst_date(now()) - 1
           end as a
  ),
  -- 連続した日付は「日付 − 行番号」が同じ値になる（gaps and islands）
  grp as (
    select d, d - (row_number() over (order by d))::int as g from days
  )
  select coalesce((
    select count(*)::int from grp
    where g = (select grp.g from grp, anchor where grp.d = anchor.a)
  ), 0);
$$;
revoke execute on function public.current_streak(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 解放判定（セッションを閉じるたびにサーバー側で行う）。戻り値は新しく解放したアイテム
-- 条件は src/lib/avatar.ts の UNLOCKABLE_ITEMS と一致させること
-- ---------------------------------------------------------
create or replace function public.evaluate_unlocks_internal(p_user_id uuid, p_session_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total  int;
  v_streak int;
  v_new    text[];
begin
  select coalesce(sum(public.session_minutes(started_at, ended_at)), 0) into v_total
  from public.study_sessions
  where user_id = p_user_id and ended_at is not null;

  v_streak := public.current_streak(p_user_id);

  with candidates (item_id, ok) as (
    values
      ('head:leaf',        true),              -- 初めての入室
      ('desk:mug',         v_total >= 10 * 60),
      ('desk:lamp',        v_total >= 25 * 60),
      ('hachimaki:indigo', v_streak >= 7),
      ('desk:plant',       v_total >= 50 * 60),
      ('head:crown',       v_streak >= 30),
      ('desk:pet',         v_total >= 100 * 60)
  ), inserted as (
    insert into public.unlocks (user_id, item_id, session_id)
    select p_user_id, c.item_id, p_session_id from candidates c where c.ok
    on conflict (user_id, item_id) do nothing
    returning item_id
  )
  select coalesce(array_agg(item_id), '{}') into v_new from inserted;

  return v_new;
end;
$$;

revoke execute on function public.evaluate_unlocks_internal(uuid, uuid) from public, anon, authenticated;

-- セッションを閉じる処理に解放判定を足す（退室・キック・cron のどれで閉じても判定される）
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
      pomodoros = v_session.pomodoros
                + case when v_room.timer_mode = 'pomodoro'
                       then public.count_pomodoros(v_room.timer_started_at, v_room.focus_minutes,
                                                   v_room.break_minutes, v_session.started_at, v_end)
                       else 0 end
  where id = v_session.id
  returning * into v_session;

  perform public.evaluate_unlocks_internal(v_session.user_id, v_session.id);

  return v_session;
end;
$$;

revoke execute on function public.close_session_internal(uuid, timestamptz) from public, anon, authenticated;

-- 退室 RPC：戻り値に新しく解放したアイテムを足す
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

  perform 1 from public.rooms where id = v_open.room_id for update;

  v_closed := public.close_session_internal(v_open.id, now());

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
    'pomodoros',  v_closed.pomodoros,
    'unlocked',   coalesce((select jsonb_agg(item_id) from public.unlocks where session_id = v_closed.id), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------
-- プロフィールの統計（だれのプロフィールでも見られる）
-- 限定部屋など、見る人が閲覧できない部屋のタグは「限定部屋」としてまとめる
-- ---------------------------------------------------------
create or replace function public.get_profile_stats(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user       uuid;
  v_today      date := public.jst_date(now());
  v_week_start date;
  v_cal_start  date;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select id into v_user from public.profiles where username = lower(p_username);
  if v_user is null then
    return null;
  end if;

  v_week_start := v_today - (extract(isodow from v_today)::int - 1);
  -- 草カレンダーは今週を含めて26週（月曜始まり）
  v_cal_start := v_week_start - 25 * 7;

  return (
    with s as (
      select public.jst_date(started_at) as d,
             public.session_minutes(started_at, ended_at) as m,
             pomodoros, room_id
      from public.study_sessions
      where user_id = v_user and ended_at is not null
    ),
    per_day as (
      select d, sum(m)::int as m from s group by d
    ),
    tagged as (
      select t.tag, s.m::numeric / cardinality(t.tags) as m
      from s
      join public.rooms r on r.id = s.room_id
      cross join lateral (
        select case
                 when not public.can_view_room(r.id) then array['限定部屋']
                 when cardinality(r.tags) = 0 then array['タグなし']
                 else r.tags
               end as tags
      ) t0
      cross join lateral (select unnest(t0.tags) as tag, t0.tags) t
      where s.m > 0
    ),
    tag_totals as (
      select tag, round(sum(m))::int as m from tagged group by tag order by sum(m) desc limit 8
    )
    select jsonb_build_object(
      'total_minutes',  coalesce((select sum(m) from s), 0),
      'total_sessions', (select count(*) from s where m >= 1),
      'total_pomodoros', coalesce((select sum(pomodoros) from s), 0),
      'week_minutes',   coalesce((select sum(m) from per_day where d >= v_week_start), 0),
      'streak_days',    public.current_streak(v_user),
      'today',          v_today,
      'week_start',     v_week_start,
      'week', (
        select jsonb_agg(jsonb_build_object('date', g.d, 'minutes', coalesce(p.m, 0)) order by g.d)
        from generate_series(v_week_start, v_week_start + 6, interval '1 day') as g0(ts)
        cross join lateral (select g0.ts::date as d) g
        left join per_day p on p.d = g.d
      ),
      'calendar_start', v_cal_start,
      'calendar', coalesce((
        select jsonb_object_agg(d::text, m) from per_day where d >= v_cal_start
      ), '{}'::jsonb),
      'tags', coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'minutes', m)) from tag_totals), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.get_profile_stats(text) from public, anon;
grant execute on function public.get_profile_stats(text) to authenticated;
