-- =========================================================
-- 休憩中は部屋の画面を離れても退室にしない
-- ポモドーロの休憩中に最後のハートビートがあった人は、休憩が終わって3分たつまで待つ
-- （戻ってこなければ、これまでどおり最後のハートビートの時刻で閉じる）
-- =========================================================

-- p_at が休憩中なら、その休憩が終わる時刻。休憩中でなければ null
create or replace function public.break_grace_until(p_room_id uuid, p_at timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    when r.timer_mode = 'pomodoro' and r.timer_started_at is not null and p_at >= r.timer_started_at
         and mod(extract(epoch from p_at - r.timer_started_at)::numeric, (r.focus_minutes + r.break_minutes) * 60) >= r.focus_minutes * 60
    then p_at + make_interval(secs => ((r.focus_minutes + r.break_minutes) * 60
                 - mod(extract(epoch from p_at - r.timer_started_at)::numeric, (r.focus_minutes + r.break_minutes) * 60))::double precision)
  end
  from public.rooms r
  where r.id = p_room_id;
$$;

revoke execute on function public.break_grace_until(uuid, timestamptz) from public, anon, authenticated;

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
      and (coalesce(public.break_grace_until(s.room_id, s.last_seen_at), s.last_seen_at) < now() - interval '3 minutes'
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
