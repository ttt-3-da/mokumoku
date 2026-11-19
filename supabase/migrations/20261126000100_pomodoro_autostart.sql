-- =========================================================
-- ポモドーロの部屋は、作った時点からタイマーが動いているようにする
-- （オーナーが「タイマーを開始」を押さなくても、入った人はすぐ集中・休憩のリズムに乗れる。
--  「最初からやり直す」は今までどおりオーナー・モデレーターができる）
-- =========================================================

create or replace function public.autostart_pomodoro_timer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.timer_mode = 'pomodoro' and new.timer_started_at is null then
    new.timer_started_at := now();
  end if;
  return new;
end;
$$;

create trigger rooms_autostart_pomodoro
  before insert or update of timer_mode on public.rooms
  for each row execute function public.autostart_pomodoro_timer();

-- いまタイマーが止まったままのポモドーロの部屋も動かす
update public.rooms
set timer_started_at = now()
where timer_mode = 'pomodoro' and timer_started_at is null and deleted_at is null;
