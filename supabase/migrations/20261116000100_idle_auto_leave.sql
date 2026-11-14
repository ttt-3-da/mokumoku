-- =========================================================
-- 退室のし忘れ対策
-- - 部屋の画面は、最後に操作してから何秒たったか（p_idle_seconds）をハートビートで送る
-- - 30分操作がないと画面で「まだ勉強中？」と聞く。返事がないまま35分たつと、
--   cron が最後に操作した時刻で退室にする（end_reason = 'idle'）
-- - 保険として、1回は12時間まで（end_reason = 'cap'）
-- =========================================================

alter table public.study_sessions
  add column last_active_at timestamptz not null default now(),
  add column end_reason text check (end_reason in ('idle', 'cap'));

drop function if exists public.heartbeat(text);

create or replace function public.heartbeat(p_task text default null, p_idle_seconds int default null)
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_task is not null and char_length(v_task) > 60 then
    raise exception 'invalid_task';
  end if;

  update public.study_sessions
  set last_seen_at = now(),
      -- 古い画面（p_idle_seconds を送らない）は、送ってきた時刻を操作した時刻とみなす
      last_active_at = greatest(last_active_at, now() - make_interval(secs => v_idle)),
      task = coalesce(v_task, task)
  where user_id = v_uid and ended_at is null
  returning * into v_session;

  if v_session.id is null then
    raise exception 'no_active_session';
  end if;

  select timer_started_at into v_timer from public.rooms where id = v_session.room_id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'room_id', v_session.room_id,
    'timer_started_at', v_timer
  );
end;
$$;

revoke execute on function public.heartbeat(text, int) from public, anon;
grant execute on function public.heartbeat(text, int) to authenticated;

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
             when s.last_active_at < now() - interval '35 minutes'
               then least(s.last_active_at, s.last_seen_at)
             else s.last_seen_at
           end,
           case
             when s.started_at < now() - interval '12 hours' then 'cap'
             when s.last_active_at < now() - interval '35 minutes' then 'idle'
           end
    from public.study_sessions s
    where s.ended_at is null
      and (s.last_seen_at < now() - interval '3 minutes'
           or s.last_active_at < now() - interval '35 minutes'
           or s.started_at < now() - interval '12 hours')
    for update skip locked
  loop
    -- 通信が切れただけ（操作は最近あった）のときは、これまでどおり end_reason なし
    perform public.close_session_internal(v_id, v_end);
    if v_reason is not null then
      update public.study_sessions set end_reason = v_reason where id = v_id;
    end if;
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
