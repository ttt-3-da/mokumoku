-- 復活コードでパスワードを再設定する pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('00000000-0000-0000-0000-0000000022a1', 'rca@users.mokumoku.invalid', '{"username":"rca"}', extensions.crypt('oldpassword', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-0000000022b2', 'rcb@users.mokumoku.invalid', '{"username":"rcb"}', extensions.crypt('oldpassword', extensions.gen_salt('bf')));

create temp table t (code text);
grant all on t to anon, authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000022a1","role":"authenticated"}', true);
select is(public.recovery_code_created_at(), null, 'はじめは復活コードがない');
insert into t select public.issue_recovery_code();
select matches((select code from t), '^[2-9A-HJKMNP-Z]{12}$', '12文字のコードが出る');
select isnt(public.recovery_code_created_at(), null, '作ったあとは作った日時がわかる');
select throws_ok($$ select * from public.recovery_codes $$, '42501', null, 'コードの表は直接読めない');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(public.reset_password_with_code('rca', 'AAAA-AAAA-AAAA', 'newpassword1') ->> 'error', 'invalid_code', 'ちがうコードでは変えられない');
select is(public.reset_password_with_code('nobody_here', 'AAAA-AAAA-AAAA', 'newpassword1') ->> 'error', 'invalid_code',
  'いないユーザーIDでも同じ答え（あるかどうかを知られない）');
select throws_ok($$ select public.reset_password_with_code('rca', 'x', 'short') $$, 'P0001', 'invalid_password', '短いパスワードにはできない');

-- 小文字・ハイフンつきで入れても通る
select is(
  public.reset_password_with_code('RCA', lower(substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9)), 'newpassword1') ? 'code',
  true, '正しいコードなら変えられて、新しいコードが返る')
from t;

reset role;
select is((select encrypted_password = extensions.crypt('newpassword1', encrypted_password) from auth.users where id = '00000000-0000-0000-0000-0000000022a1'),
  true, 'パスワードが新しくなる');

set local role anon;
select is(public.reset_password_with_code('rca', code, 'newpassword2') ->> 'error', 'invalid_code', '使ったコードはもう使えない') from t;

-- rcb：コードを作ってから5回まちがえると、正しいコードでもしばらく試せない
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000022b2","role":"authenticated"}', true);
delete from t;
insert into t select public.issue_recovery_code();
reset role;
set local role anon;
select public.reset_password_with_code('rcb', 'WRONGWRONG22', 'newpassword1') from generate_series(1, 5);
select is(public.reset_password_with_code('rcb', code, 'newpassword1') ->> 'error', 'too_many_attempts', '5回まちがえると、しばらく試せない') from t;
reset role;
select is((select count(*)::int from public.recovery_attempts where user_id = '00000000-0000-0000-0000-0000000022b2'), 5, 'まちがえた回数は残る');
select is((select encrypted_password = extensions.crypt('oldpassword', encrypted_password) from auth.users where id = '00000000-0000-0000-0000-0000000022b2'),
  true, 'パスワードは変わっていない');

select * from finish();
rollback;
