-- =========================================================
-- Phase 9: ポモドーロ同期
-- 各クライアントは rooms.timer_started_at だけを基準に現在のフェーズを計算する。
-- タイマー開始（やり直し）は RPC で行い、Broadcast で全員に通知する。
-- =========================================================

-- タイマーをやり直してもそれまでのポモドーロが消えないよう、
-- セッションを閉じるときは「保存済みの回数＋今のタイマーでの回数」にする
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

  return v_session;
end;
$$;

revoke execute on function public.close_session_internal(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------
-- タイマー開始 RPC（オーナー・モデレーターのみ）。戻り値は新しい開始時刻
-- ---------------------------------------------------------
create or replace function public.start_timer(p_room_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_now  timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if v_room.closed_at is not null then
    raise exception 'room_closed';
  end if;
  if v_room.timer_mode <> 'pomodoro' then
    raise exception 'not_pomodoro_room';
  end if;

  -- やり直す前のタイマーで完了したポモドーロを、入室中の人のセッションに足しておく
  if v_room.timer_started_at is not null then
    update public.study_sessions s
    set pomodoros = s.pomodoros + public.count_pomodoros(
          v_room.timer_started_at, v_room.focus_minutes, v_room.break_minutes, s.started_at, v_now)
    where s.room_id = p_room_id and s.ended_at is null;
  end if;

  update public.rooms set timer_started_at = v_now where id = p_room_id;
  return v_now;
end;
$$;

revoke execute on function public.start_timer(uuid) from public, anon;
grant execute on function public.start_timer(uuid) to authenticated;

-- ---------------------------------------------------------
-- サーバー時刻。クライアントは往復時間の半分を引いて時計のズレを補正する
-- ---------------------------------------------------------
create or replace function public.server_now()
returns timestamptz
language sql
volatile
set search_path = public
as $$
  select clock_timestamp();
$$;

revoke execute on function public.server_now() from public, anon;
grant execute on function public.server_now() to authenticated;
