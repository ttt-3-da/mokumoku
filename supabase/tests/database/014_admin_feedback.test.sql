-- 管理者・利用停止・予約したユーザーID・通報の対応・フィードバックの pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);
-- E2E で手元に残ったフィードバックで数がずれないように（最後に rollback で戻る）
delete from public.feedback;

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000014a1', 'adm1@users.mokumoku.invalid', '{"username":"adm1"}'),
  ('00000000-0000-0000-0000-0000000014b2', 'usr1@users.mokumoku.invalid', '{"username":"usr1"}');

insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes, is_persistent)
values ('24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000014b2', 'あやしい部屋', 'public', 'free', 25, 5, true);
insert into public.reports (reporter_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-0000000014a1', 'room', '24000000-0000-0000-0000-000000000001', 'スパム');

select is(public.is_username_available('mokumoku'), false, '予約したユーザーIDは使えない');
select throws_ok($$ insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-0000000014c3', 'admin@users.mokumoku.invalid', '{"username":"admin"}') $$,
  '22023', 'invalid_username', '予約したユーザーIDでは登録できない');

-- 管理者でなければ使えない
select pg_temp.login('00000000-0000-0000-0000-0000000014b2');
select throws_ok($$ select * from public.admin_list_reports() $$, 'P0001', 'admin_only', '管理者でなければ通報を見られない');
select throws_ok($$ update public.profiles set is_admin = true where id = auth.uid() $$, '42501', null, '自分で管理者にはなれない');
select lives_ok($$ select public.send_feedback('bug', 'タイマーが止まります', '/rooms') $$, 'フィードバックを送れる');
select pg_temp.logout();

select public.make_official('adm1', 'mokumoku');
select is((select is_admin from public.profiles where username = 'mokumoku'), true, 'make_official で管理者になり、予約した名前にも変えられる');
select is((select email from auth.users where id = '00000000-0000-0000-0000-0000000014a1')::text, 'mokumoku@users.mokumoku.invalid', 'ログインIDも新しい名前になる');

select pg_temp.login('00000000-0000-0000-0000-0000000014a1');
select is((select count(*)::int from public.admin_list_reports()), 1, '管理者は通報を見られる');
select is((select count(*)::int from public.admin_list_feedback()), 1, '管理者はフィードバックを読める');
select public.admin_resolve_reports('room', '24000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.admin_list_reports(true)), 1, '対応済みにできる');
select public.admin_delete_room('24000000-0000-0000-0000-000000000001');
select isnt((select deleted_at from public.rooms where id = '24000000-0000-0000-0000-000000000001'), null, '管理者はどの部屋も削除できる');
select public.admin_set_suspended('00000000-0000-0000-0000-0000000014b2', true);
select pg_temp.logout();

select throws_ok($$ insert into public.study_sessions (room_id, user_id, task)
  values ('24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000014b2', 'x') $$,
  'P0001', 'suspended', '利用停止中の人は入室できない');

select pg_temp.login('00000000-0000-0000-0000-0000000014a1');
select public.admin_set_suspended('00000000-0000-0000-0000-0000000014b2', false);
select pg_temp.logout();
select is((select suspended_at from public.profiles where id = '00000000-0000-0000-0000-0000000014b2'), null, '利用停止は元に戻せる');

select * from finish();
rollback;
