-- 管理者のコインが無限になる pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000019a1', 'uc1@users.mokumoku.invalid', '{"username":"uc1"}'),
  ('00000000-0000-0000-0000-0000000019a2', 'uc2@users.mokumoku.invalid', '{"username":"uc2"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000019a1';

select is(public.coin_balance('00000000-0000-0000-0000-0000000019a1'), 1000000000, '管理者の残高は無限');
select ok(public.coin_balance('00000000-0000-0000-0000-0000000019a2') < 1000000, 'ふつうの人はふつうの残高');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
select lives_ok(
  $$ select public.buy_item((select item_id from public.shop_items where currency = 'coin' order by price desc limit 1)) $$,
  'いちばん高いものも買える');
select is((public.my_wallet() ->> 'coins')::int, 1000000000, '買っても減らない');

select * from finish();
rollback;
