-- 部屋のタイマー（だれもいなくなったら止める）と部屋の🍅の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000012a1', 'tma@users.mokumoku.invalid', '{"username":"tma"}'),
  ('00000000-0000-0000-0000-0000000012b2', 'tmb@users.mokumoku.invalid', '{"username":"tmb"}');

insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes, is_persistent, timer_started_at)
values ('22000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000012a1', 'ポモ', 'public', 'pomodoro', 25, 5, true,
        now() - interval '2 hours');

insert into public.study_sessions (room_id, user_id, task, started_at) values
  ('22000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000012a1', '数学', now() - interval '60 minutes'),
  ('22000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000012b2', '英語', now() - interval '40 minutes');

select is(public.room_tomatoes('22000000-0000-0000-0000-000000000001'), 4,
  '部屋の🍅に、勉強中の人の時間も入る（60分＋40分＝🍅4）');

select public.close_session_internal(id, now()) from public.study_sessions
where user_id = '00000000-0000-0000-0000-0000000012a1' and ended_at is null;
select isnt((select timer_started_at from public.rooms where id = '22000000-0000-0000-0000-000000000001'), null,
  'まだ人がいる間はタイマーは動いたまま');

select public.close_session_internal(id, now()) from public.study_sessions
where user_id = '00000000-0000-0000-0000-0000000012b2' and ended_at is null;
select is((select timer_started_at from public.rooms where id = '22000000-0000-0000-0000-000000000001'), null,
  '最後の1人が退室するとタイマーが止まる');
select is((select timer_resume from public.rooms where id = '22000000-0000-0000-0000-000000000001'), true,
  '次に入った人のときに始める印が付く');

insert into public.study_sessions (room_id, user_id, task)
values ('22000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000012a1', '数学');
select is((select timer_started_at from public.rooms where id = '22000000-0000-0000-0000-000000000001'), now(),
  'だれかが入るとタイマーが最初から始まる');

-- だれもいない部屋で、10分以上前に始まったタイマーは止める
insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes, is_persistent, timer_started_at)
values ('22000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000012a1', '定例', 'public', 'pomodoro', 25, 5, true,
        now() - interval '15 minutes');
select public.stop_empty_room_timers();
select is((select timer_started_at from public.rooms where id = '22000000-0000-0000-0000-000000000002'), null,
  'だれも来なかった定例の部屋のタイマーは止まる');

select * from finish();
rollback;
