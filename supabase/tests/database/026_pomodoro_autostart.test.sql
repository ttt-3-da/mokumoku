-- ポモドーロの部屋は、最初の1人が入った時点でタイマーが始まる（だれもいない間は止まっている）pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000026a1', 'pta@users.mokumoku.invalid', '{"username":"pta"}');

insert into public.rooms (id, owner_id, name, timer_mode) values
  ('26000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000026a1', 'ポモの部屋', 'pomodoro'),
  ('26000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000026a1', '自由の部屋', 'free'),
  ('26000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000026a1', 'あとでポモの部屋', 'free');

select is((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000a1'), null, 'だれもいない間はタイマーは止まっている');

insert into public.study_sessions (room_id, user_id, task)
values ('26000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000026a1', '数学');
select isnt((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000a1'), null, '最初の1人が入るとタイマーが始まる');

update public.study_sessions set ended_at = now() where room_id = '26000000-0000-0000-0000-0000000000a1';
select is((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000a1'), null, 'だれもいなくなると止まる');

select is((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000b2'), null, '自由の部屋にはタイマーがない');

-- だれもいない部屋をポモドーロに変えたら、次に入ったときに始まる
update public.rooms set timer_mode = 'pomodoro' where id = '26000000-0000-0000-0000-0000000000b2';
insert into public.study_sessions (room_id, user_id, task)
values ('26000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000026a1', '英語');
select isnt((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000b2'), null, 'あとでポモドーロにした部屋も、入ると始まる');

-- だれかいる部屋をポモドーロに変えたら、すぐ始まる
update public.study_sessions set ended_at = now() where room_id = '26000000-0000-0000-0000-0000000000b2';
insert into public.study_sessions (room_id, user_id, task)
values ('26000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000026a1', '国語');
update public.rooms set timer_mode = 'pomodoro' where id = '26000000-0000-0000-0000-0000000000c3';
select isnt((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000c3'), null, 'だれかいる部屋をポモドーロにすると、すぐ始まる');

select * from finish();
rollback;
