-- =========================================================
-- Phase 10: ハートビートと pg_cron による後処理
-- クライアントは60秒ごとに heartbeat を呼んで last_seen_at を更新する。
-- 毎分の cron で、last_seen_at が3分以上前の未終了セッションを ended_at = last_seen_at で閉じ、
-- 在室者がいない一時部屋を閉じる。
-- =========================================================

-- ---------------------------------------------------------
-- ハートビート。p_task を渡すと「今やること」も保存する（Presence だけだと記録に残らないため）
-- 戻り値: { session_id, room_id, timer_started_at }
-- ---------------------------------------------------------
create or replace function public.heartbeat(p_task text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_task    text := nullif(btrim(coalesce(p_task, '')), '');
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

revoke execute on function public.heartbeat(text) from public, anon;
grant execute on function public.heartbeat(text) to authenticated;

-- ---------------------------------------------------------
-- 後処理（cron から呼ぶ。クライアントからは呼べない）
-- 入室・退室と同時に走ってもデッドロックしないよう、ロックは skip locked で取る
-- （取れなかった行は次の分に回す）
-- 戻り値: { closed_sessions, closed_rooms }
-- ---------------------------------------------------------
create or replace function public.cleanup_stale_sessions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_sessions int := 0;
  v_rooms    int := 0;
begin
  for v_id in
    select id from public.study_sessions
    where ended_at is null and last_seen_at < now() - interval '3 minutes'
    for update skip locked
  loop
    perform public.close_session_internal(
      v_id, (select last_seen_at from public.study_sessions where id = v_id));
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
    -- 行ロックを取ってから（この文の新しいスナップショットで）在室者を確認する
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

-- ---------------------------------------------------------
-- pg_cron で毎分実行（同じ名前なら上書きされる）
-- ---------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule('mokumoku-cleanup', '* * * * *', 'select public.cleanup_stale_sessions()');
