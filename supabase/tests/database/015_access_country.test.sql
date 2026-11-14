-- アクセスした国の記録の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000015a1', 'acc1@users.mokumoku.invalid', '{"username":"acc1"}');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}', true);
select public.touch_access('jp');
select public.touch_access('not-a-country');
select throws_ok($$ select public.admin_get_access('00000000-0000-0000-0000-0000000015a1') $$, 'P0001', 'admin_only', '管理者でなければ見られない');
select throws_ok($$ select * from public.user_access $$, '42501', null, '記録を直接読めない');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);

select is((select first_country from public.user_access where user_id = '00000000-0000-0000-0000-0000000015a1'), 'JP', '国コードを大文字で記録する');
select is((select last_country from public.user_access where user_id = '00000000-0000-0000-0000-0000000015a1'), 'JP', 'おかしな値では上書きしない');

select * from finish();
rollback;
