-- =========================================================
-- ポモドーロの自動開始の直し
-- 前の変更（作った時点でタイマーを動かす）だと、だれもいない部屋でもタイマーが動き続けていた。
-- もともと「最後の1人が退室したら止め、次にだれかが入ったら最初から始める」しくみ（timer_resume）があるので、
-- 新しい部屋もそれに乗せる：作った時点では止めておき、最初の1人が入った瞬間に始める。
-- =========================================================

create or replace function public.autostart_pomodoro_timer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.timer_mode = 'pomodoro' and new.timer_started_at is null
     and (tg_op = 'INSERT' or old.timer_mode is distinct from 'pomodoro') then
    if tg_op = 'UPDATE' and exists (select 1 from public.study_sessions s where s.room_id = new.id and s.ended_at is null) then
      -- だれかいる部屋をポモドーロに変えたら、すぐ始める
      new.timer_started_at := now();
    else
      -- だれもいなければ、最初の1人が入ったときに始める
      new.timer_resume := true;
    end if;
  end if;
  return new;
end;
$$;

-- 前の変更で動かした、だれもいない部屋のタイマーを止め、次に入ったときに始まるようにする
update public.rooms r
set timer_started_at = null, timer_resume = true
where r.timer_mode = 'pomodoro'
  and r.timer_started_at is not null
  and not exists (select 1 from public.study_sessions s where s.room_id = r.id and s.ended_at is null);

-- 止まったまま、だれかが入っても始まらない部屋（timer_resume が立っていない）も、次に入ったときに始まるようにする
update public.rooms
set timer_resume = true
where timer_mode = 'pomodoro' and timer_started_at is null and not timer_resume;
