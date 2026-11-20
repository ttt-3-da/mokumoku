-- =========================================================
-- ほかのタブを見ている間に部屋から落ちる、の直し
-- 1. タブが見えなくなったら hidden_since を記録する（/api/hidden から mark_hidden）。
--    見えていない間はブラウザがハートビートを止めることがあるので、3分の「通信切れ」退室をしない。
--    - 見えなくなってから15分までは勉強時間に入れる。15分をこえたら「離席中」（勉強時間に入れない）
--    - 見えなくなってから35分戻らなければ退室（記録は見えなくなってから15分のところまで）
--    - 15分をこえてから戻ったら、記録を「見えなくなって15分」のところで区切り、同じ部屋で続きを始める
-- 2. 自動で退室になった人が画面に戻ったら、同じ部屋に入り直せる（rejoin_after_drop）
-- =========================================================

alter table public.study_sessions
  add column hidden_since timestamptz,
  add column auto_closed boolean not null default false;

alter table public.study_sessions drop constraint study_sessions_end_reason_check;
alter table public.study_sessions add constraint study_sessions_end_reason_check
  check (end_reason in ('idle', 'cap', 'away'));

-- タブが見えなくなった（sendBeacon で呼ばれる）
create or replace function public.mark_hidden()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.study_sessions
  set hidden_since = coalesce(hidden_since, now()),
      -- ほかのタブへ移ったのも操作のうち（35分の退室は、見えなくなったときから数える）
      last_active_at = case when hidden_since is null then now() else last_active_at end,
      last_seen_at = now()
  where user_id = auth.uid() and ended_at is null;
end;
$$;
revoke execute on function public.mark_hidden() from public, anon;
grant execute on function public.mark_hidden() to authenticated;

-- ハートビート。p_hidden = いまタブが見えていないか
drop function public.heartbeat(text, int);
create function public.heartbeat(p_task text default null, p_idle_seconds int default null, p_hidden boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_task    text := nullif(btrim(coalesce(p_task, '')), '');
  v_idle    int := greatest(coalesce(p_idle_seconds, 0), 0);
  v_session public.study_sessions;
  v_timer   timestamptz;
  v_entered jsonb;
  v_split   boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_task is not null and char_length(v_task) > 60 then
    raise exception 'invalid_task';
  end if;

  select * into v_session from public.study_sessions
  where user_id = v_uid and ended_at is null
  for update;
  if v_session.id is null then
    raise exception 'no_active_session';
  end if;

  if p_hidden is false and v_session.hidden_since is not null
     and v_session.hidden_since < now() - interval '15 minutes' then
    -- 15分をこえて離れていた：記録を区切って、同じ部屋で続きを始める
    perform public.close_session_internal(v_session.id, v_session.hidden_since + interval '15 minutes');
    update public.study_sessions set end_reason = 'away', auto_closed = true where id = v_session.id;
    begin
      v_entered := public.enter_room(v_session.room_id, coalesce(v_task, v_session.task), null);
    exception when others then
      -- 満員・部屋が閉じたなど：戻れない
      return jsonb_build_object('lost', true, 'session_id', v_session.id);
    end;
    select * into v_session from public.study_sessions where id = (v_entered->>'session_id')::uuid;
    v_split := true;
  else
    update public.study_sessions
    set last_seen_at = now(),
        leaving_at = null,
        -- 古い画面（p_idle_seconds を送らない）は、送ってきた時刻を操作した時刻とみなす
        last_active_at = case
          when p_hidden is true and hidden_since is null then now()
          when p_hidden is true then last_active_at
          else greatest(last_active_at, now() - make_interval(secs => v_idle))
        end,
        hidden_since = case
          when p_hidden is true then coalesce(hidden_since, now())
          when p_hidden is false then null
          else hidden_since
        end,
        task = coalesce(v_task, task)
    where id = v_session.id
    returning * into v_session;
  end if;

  select timer_started_at into v_timer from public.rooms where id = v_session.room_id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'room_id', v_session.room_id,
    'timer_started_at', v_timer,
    'split', v_split
  );
end;
$$;
revoke execute on function public.heartbeat(text, int, boolean) from public, anon;
grant execute on function public.heartbeat(text, int, boolean) to authenticated;

create or replace function public.cleanup_stale_sessions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_end      timestamptz;
  v_reason   text;
  v_sessions int := 0;
  v_rooms    int := 0;
begin
  for v_id, v_end, v_reason in
    select s.id,
           case
             when s.started_at < now() - interval '12 hours'
               then least(s.started_at + interval '12 hours', s.last_active_at, s.last_seen_at)
             when s.leaving_at is not null and s.leaving_at < now() - interval '30 seconds'
                  and public.break_grace_until(s.room_id, s.leaving_at) is null
               then least(greatest(s.leaving_at, s.started_at),
                          coalesce(s.hidden_since + interval '15 minutes', 'infinity'::timestamptz))
             when s.hidden_since is not null
               then s.hidden_since + interval '15 minutes'
             when s.last_active_at < now() - interval '35 minutes'
               then least(s.last_active_at, s.last_seen_at)
             else s.last_seen_at
           end,
           case
             when s.started_at < now() - interval '12 hours' then 'cap'
             when s.leaving_at is not null and s.leaving_at < now() - interval '30 seconds'
                  and public.break_grace_until(s.room_id, s.leaving_at) is null then null
             when s.hidden_since is not null then 'away'
             when s.last_active_at < now() - interval '35 minutes' then 'idle'
           end
    from public.study_sessions s
    where s.ended_at is null
      and ((s.hidden_since is null
            and coalesce(public.break_grace_until(s.room_id, s.last_seen_at), s.last_seen_at) < now() - interval '3 minutes')
           or (s.hidden_since is null and s.last_active_at < now() - interval '35 minutes')
           or (s.hidden_since is not null and s.hidden_since < now() - interval '35 minutes')
           or s.started_at < now() - interval '12 hours'
           or (s.leaving_at is not null and s.leaving_at < now() - interval '30 seconds'
               and public.break_grace_until(s.room_id, s.leaving_at) is null))
    for update skip locked
  loop
    perform public.close_session_internal(v_id, v_end);
    update public.study_sessions set end_reason = v_reason, auto_closed = true where id = v_id;
    v_sessions := v_sessions + 1;
  end loop;

  -- 在室者がいない一時部屋を閉じる。作ってすぐ（入室する前）に閉じないよう10分の猶予を置く
  for v_id in
    select r.id from public.rooms r
    where not r.is_persistent
      and r.closed_at is null
      and r.created_at < now() - interval '10 minutes'
    for update skip locked
  loop
    update public.rooms set closed_at = now()
    where id = v_id
      and not exists (select 1 from public.study_sessions where room_id = v_id and ended_at is null);
    if found then
      v_rooms := v_rooms + 1;
    end if;
  end loop;

  return jsonb_build_object('closed_sessions', v_sessions, 'closed_rooms', v_rooms);
end;
$$;
revoke execute on function public.cleanup_stale_sessions() from public, anon, authenticated;

-- 自動で退室になった人が、画面に戻ってきたら同じ部屋に入り直す
-- （キック・一斉退出・部屋の削除・自分で退室したときは auto_closed にならないので戻さない）
create or replace function public.rejoin_after_drop(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.study_sessions;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_old from public.study_sessions
  where id = p_session_id and user_id = auth.uid() and ended_at is not null
    and auto_closed and ended_at > now() - interval '12 hours';
  if not found then
    raise exception 'cannot_rejoin';
  end if;
  if exists (select 1 from public.rooms where id = v_old.room_id and deleted_at is not null) then
    raise exception 'room_closed';
  end if;
  return public.enter_room(v_old.room_id, v_old.task, null);
end;
$$;
revoke execute on function public.rejoin_after_drop(uuid) from public, anon;
grant execute on function public.rejoin_after_drop(uuid) to authenticated;

-- 部屋の中で、タブが見えていない人（画面が止まって Presence から消えても、部屋にはいる）
create or replace function public.get_room_hidden_members(p_room_id uuid)
returns table (user_id uuid, display_name text, avatar jsonb, task text, started_at timestamptz, hidden_since timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, p.display_name, public.avatar_json(p.id), s.task, s.started_at, s.hidden_since
  from public.study_sessions s
  join public.profiles p on p.id = s.user_id
  where s.room_id = p_room_id and s.ended_at is null and s.hidden_since is not null
    and exists (select 1 from public.study_sessions me
                where me.user_id = auth.uid() and me.room_id = p_room_id and me.ended_at is null);
$$;
revoke execute on function public.get_room_hidden_members(uuid) from public, anon;
grant execute on function public.get_room_hidden_members(uuid) to authenticated;
