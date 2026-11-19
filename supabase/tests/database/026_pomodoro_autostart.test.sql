-- ポモドーロの部屋は作った時点からタイマーが動いている pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000026a1', 'pta@users.mokumoku.invalid', '{"username":"pta"}');

insert into public.rooms (id, owner_id, name, timer_mode) values
  ('26000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000026a1', 'ポモの部屋', 'pomodoro'),
  ('26000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000026a1', '自由の部屋', 'free');

select isnt((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000a1'), null, 'ポモドーロの部屋は作った時点でタイマーが動いている');
select is((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000b2'), null, '自由の部屋にはタイマーがない');

update public.rooms set timer_mode = 'pomodoro' where id = '26000000-0000-0000-0000-0000000000b2';
select isnt((select timer_started_at from public.rooms where id = '26000000-0000-0000-0000-0000000000b2'), null, 'あとからポモドーロにしても、すぐ動く');

select * from finish();
rollback;
