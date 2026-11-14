-- 休憩中は画面を離れても退室にならない pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000013a1', 'bra@users.mokumoku.invalid', '{"username":"bra"}'),
  ('00000000-0000-0000-0000-0000000013b2', 'brb@users.mokumoku.invalid', '{"username":"brb"}');

-- 25分集中・5分休憩。タイマーは31分前に始まった。4分前は休憩の2分目（休憩は1分前に終わった）
insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes, is_persistent, timer_started_at)
values ('23000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000013a1', 'ポモ', 'public', 'pomodoro', 25, 5, true,
        now() - interval '31 minutes');

-- a：休憩中（27分目）に画面を離れた
insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at)
values ('23000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000013a1', '数学',
        now() - interval '28 minutes', now() - interval '4 minutes', now() - interval '4 minutes');
-- b：集中中（23分目）に画面を離れた
insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at)
values ('23000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000013b2', '英語',
        now() - interval '28 minutes', now() - interval '8 minutes', now() - interval '8 minutes');

select is(public.break_grace_until('23000000-0000-0000-0000-000000000001', now() - interval '4 minutes'),
  now() - interval '1 minute', '休憩中の時刻なら、その休憩が終わる時刻が返る');

select public.cleanup_stale_sessions();
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000013a1'),
  null, '休憩中に離れた人は、休憩が終わって3分たつまで退室にならない');
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000013b2'),
  now() - interval '8 minutes', '集中中に離れた人は、これまでどおり3分で退室になる');

select * from finish();
rollback;
