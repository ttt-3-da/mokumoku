-- 退室のし忘れ対策（操作のない時間・12時間の上限）の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000011a1', 'idlea@users.mokumoku.invalid', '{"username":"idlea"}'),
  ('00000000-0000-0000-0000-0000000011b2', 'idleb@users.mokumoku.invalid', '{"username":"idleb"}'),
  ('00000000-0000-0000-0000-0000000011c3', 'idlec@users.mokumoku.invalid', '{"username":"idlec"}'),
  ('00000000-0000-0000-0000-0000000011d4', 'idled@users.mokumoku.invalid', '{"username":"idled"}');

insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes, is_persistent)
values ('21000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000011a1', '自習', 'public', 'free', 25, 5, true);

-- a：ハートビートを送る人
insert into public.study_sessions (room_id, user_id, task, started_at, last_active_at)
values ('21000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000011a1', '数学', now() - interval '1 hour', now() - interval '1 hour');

select pg_temp.login('00000000-0000-0000-0000-0000000011a1');
select public.heartbeat(null, 600);
select pg_temp.logout();
select is((select last_active_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011a1'),
  now() - interval '10 minutes', '最後に操作してからの秒数で last_active_at が決まる');

select pg_temp.login('00000000-0000-0000-0000-0000000011a1');
select public.heartbeat(null, 1800);
select public.heartbeat(null, -5);
select pg_temp.logout();
select is((select last_active_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011a1'),
  now(), '操作した時刻は前に戻らず、負の秒数は0として扱う');

-- b：画面は開いたまま（通信は続く）だが、40分操作がない
insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at)
values ('21000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000011b2', '英語',
        now() - interval '2 hours', now(), now() - interval '40 minutes');
-- c：12時間を超えている（操作は続いている）
insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at)
values ('21000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000011c3', '物理',
        now() - interval '13 hours', now(), now());
-- d：通信が5分前に切れた（その1分前まで操作していた）
insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at)
values ('21000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000011d4', '化学',
        now() - interval '1 hour', now() - interval '5 minutes', now() - interval '6 minutes');

select public.cleanup_stale_sessions();

select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011a1'),
  null, '最近操作していれば退室にならない');
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011b2'),
  now() - interval '40 minutes', '35分以上操作がないと、最後に操作した時刻で退室になる');
select is((select end_reason from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011b2'),
  'idle', '操作がなくて退室になったことが残る');
select is((select ended_at - started_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011c3'),
  interval '12 hours', '1回は12時間で切られる');
select is((select end_reason from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011c3'),
  'cap', '12時間で切られたことが残る');
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011d4'),
  now() - interval '5 minutes', '通信が切れたときは、これまでどおり最後のハートビートの時刻で閉じる');
select is((select end_reason from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000011d4'),
  null, '通信が切れただけなら end_reason は付かない');

select * from finish();
rollback;
