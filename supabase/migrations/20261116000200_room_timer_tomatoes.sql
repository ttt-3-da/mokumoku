-- =========================================================
-- 部屋のポモドーロと🍅の直し
-- 1. だれもいなくなったらタイマーを止める（止めたまま「完了 🍅×n」が増え続けていた）。
--    次にだれかが入ったら、最初から自動で始める（timer_resume）
-- 2. 部屋の🍅に、いま勉強中の人の時間も入れる（退室するまで増えなかった）
-- =========================================================

alter table public.rooms add column timer_resume boolean not null default false;

-- 最後の1人が退室したらタイマーを止める
create or replace function public.room_timer_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.ended_at is null and new.ended_at is not null
     and not exists (select 1 from public.study_sessions where room_id = new.room_id and ended_at is null) then
    update public.rooms
    set timer_started_at = null, timer_resume = true
    where id = new.room_id and timer_started_at is not null;
  end if;
  return new;
end;
$$;

revoke execute on function public.room_timer_on_leave() from public, anon, authenticated;

create trigger study_sessions_room_timer_leave
  after update of ended_at on public.study_sessions
  for each row execute function public.room_timer_on_leave();

-- 止まっていた部屋にだれかが入ったら、タイマーを最初から始める
create or replace function public.room_timer_on_enter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms
  set timer_started_at = now(), timer_resume = false
  where id = new.room_id and timer_resume and timer_started_at is null and timer_mode = 'pomodoro';
  return new;
end;
$$;

revoke execute on function public.room_timer_on_enter() from public, anon, authenticated;

create trigger study_sessions_room_timer_enter
  after insert on public.study_sessions
  for each row execute function public.room_timer_on_enter();

-- 今だれもいないのにタイマーが動いている部屋は止めておく
update public.rooms r
set timer_started_at = null, timer_resume = true
where r.timer_started_at is not null
  and not exists (select 1 from public.study_sessions s where s.room_id = r.id and s.ended_at is null);

-- 部屋の🍅の残り＝（その部屋のセッションの合計分 ÷ 25）− 使った分。勉強中のセッションは今までの分を数える
create or replace function public.room_tomatoes(p_room_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (coalesce((select sum(public.session_minutes(started_at, coalesce(ended_at, now())))
                    from public.study_sessions
                    where room_id = p_room_id), 0) / 25)::int
       - coalesce((select sum(price_paid) from public.room_owned_themes where room_id = p_room_id), 0)::int;
$$;

revoke execute on function public.room_tomatoes(uuid) from public, anon, authenticated;

-- 定例の部屋は、だれもいなくても開始時刻にタイマーが始まる。
-- 10分たってもだれも入らなければ止めて、次に入った人のときに始める
create or replace function public.stop_empty_room_timers()
returns void
language sql
security definer
set search_path = public
as $$
  update public.rooms r
  set timer_started_at = null, timer_resume = true
  where r.timer_started_at < now() - interval '10 minutes'
    and not exists (select 1 from public.study_sessions s where s.room_id = r.id and s.ended_at is null);
$$;

revoke execute on function public.stop_empty_room_timers() from public, anon, authenticated;

select cron.schedule('mokumoku-empty-timers', '* * * * *', 'select public.stop_empty_room_timers()');
