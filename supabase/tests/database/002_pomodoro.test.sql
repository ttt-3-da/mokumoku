begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

-- 25分集中 / 5分休憩、9:00 開始。集中が終わるのは 9:25, 9:55, 10:25, ...
select is(public.count_pomodoros(null, 25, 5, '2026-11-12 09:00+00', '2026-11-12 12:00+00'), 0, 'タイマー未開始なら0');
select is(public.count_pomodoros('2026-11-12 09:00+00', 25, 5, '2026-11-12 09:00+00', '2026-11-12 09:24+00'), 0, '最初の集中が終わる前は0');
select is(public.count_pomodoros('2026-11-12 09:00+00', 25, 5, '2026-11-12 09:00+00', '2026-11-12 10:07+00'), 2, '9:25 と 9:55 の2回');
select is(public.count_pomodoros('2026-11-12 09:00+00', 25, 5, '2026-11-12 09:26+00', '2026-11-12 10:07+00'), 1, '途中入室なら入室後の分だけ');
select is(public.count_pomodoros('2026-11-12 09:00+00', 25, 5, '2026-11-12 08:00+00', '2026-11-12 09:30+00'), 1, 'タイマー開始前に入室していても数えすぎない');

select * from finish();
rollback;
