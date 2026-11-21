-- =========================================================
-- 電源が切れた・通信が切れたなどで画面からの知らせ（ハートビート）が止まったとき、
-- 何分で退室にするかを、1人ずつ選べるようにする（1・5・10・15・20・25・30分。はじめは5分）。
-- これまでは全員3分。記録はこれまでどおり、最後に知らせが届いた時刻まで。
-- タブを閉じたとき（30秒）、ほかのタブを見ているとき（35分）、操作がないとき（35分）は変えない
-- =========================================================

alter table public.profiles add column offline_leave_minutes int not null default 5
  check (offline_leave_minutes in (1, 5, 10, 15, 20, 25, 30));
comment on column public.profiles.offline_leave_minutes is '知らせが止まってから退室にするまでの分（電源が切れたときなど）';
grant update (offline_leave_minutes) on public.profiles to authenticated;

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
    join public.profiles p on p.id = s.user_id
    where s.ended_at is null
      and ((s.hidden_since is null
            and coalesce(public.break_grace_until(s.room_id, s.last_seen_at), s.last_seen_at) < now() - make_interval(mins => p.offline_leave_minutes))
           or (s.hidden_since is null and s.last_active_at < now() - interval '35 minutes')
           or (s.hidden_since is not null and s.hidden_since < now() - interval '35 minutes')
           or s.started_at < now() - interval '12 hours'
           or (s.leaving_at is not null and s.leaving_at < now() - interval '30 seconds'
               and public.break_grace_until(s.room_id, s.leaving_at) is null))
    for update of s skip locked
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
