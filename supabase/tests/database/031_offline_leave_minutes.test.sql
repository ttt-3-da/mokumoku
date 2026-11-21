-- 知らせが止まってから退室にするまでの分（1人ずつ選べる）pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000031a1', 'ola@users.mokumoku.invalid', '{"username":"ola"}'),
  ('00000000-0000-0000-0000-0000000031b2', 'olb@users.mokumoku.invalid', '{"username":"olb"}');
insert into public.rooms (id, owner_id, name, is_persistent) values ('31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000031a1', 'r', true);

select is((select offline_leave_minutes from public.profiles where id = '00000000-0000-0000-0000-0000000031a1'), 5, 'はじめは5分');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000031a1","role":"authenticated"}', true);
select throws_ok($$ update public.profiles set offline_leave_minutes = 3 where id = auth.uid() $$, '23514', null, '選べるのは1・5・10…30分だけ');
update public.profiles set offline_leave_minutes = 30 where id = auth.uid();
reset role;
select is((select offline_leave_minutes from public.profiles where id = '00000000-0000-0000-0000-0000000031a1'), 30, '自分で30分にできる');

-- どちらも12分前から知らせが止まっている。a は30分、b は10分にしている
update public.profiles set offline_leave_minutes = 10 where id = '00000000-0000-0000-0000-0000000031b2';
insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at) values
  ('31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000031a1', '数学', now() - interval '20 minutes', now() - interval '12 minutes', now() - interval '12 minutes'),
  ('31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000031b2', '英語', now() - interval '20 minutes', now() - interval '12 minutes', now() - interval '12 minutes');
select public.cleanup_stale_sessions();
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000031a1'), null, '30分にした人は、まだ退室にならない');
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000031b2'), now() - interval '12 minutes', '10分にした人は、最後に知らせが届いた時刻で退室になる');

select * from finish();
rollback;
