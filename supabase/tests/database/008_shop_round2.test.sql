-- ショップ2回目（目・口・ほっぺ）の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- バッジのコインとお知らせは 010 で確かめる。ここでは数がずれないよう止めておく
update public.badge_defs set coins = 0;
alter table public.follows disable trigger follows_badge;
alter table public.rooms disable trigger rooms_badge;

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000006a1', 'parts_amy@users.mokumoku.invalid', '{"username":"parts_amy"}');

select is((select count(*)::int from public.shop_items where kind in ('eyes', 'mouth', 'cheeks')), 90, '目・口・ほっぺが30種ずつ売られている');
select is((select price from public.shop_items where item_id = 'eyes:nijiiro'), 150, 'にじいろの瞳はレア（150）');

select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
select throws_ok($$ select public.save_avatar('shiro', 'heart', 'omega', 'pink', 'none', 'none', 'red') $$,
  'P0001', 'item_locked', '買っていない目は使えない');
select is(public.buy_item('eyes:heart'), 5, 'ハートの目（25）を買うと残り5コイン');
select is((public.save_avatar('shiro', 'heart', 'omega', 'pink', 'none', 'none', 'red')) ->> 'eyes', 'heart', '買った目は使える');
select throws_ok($$ select public.save_avatar('shiro', 'heart', 'ni', 'pink', 'none', 'none', 'red') $$,
  'P0001', 'item_locked', '買っていない口は使えない');
select throws_ok($$ select public.save_avatar('shiro', 'heart', 'omega', 'niji', 'none', 'none', 'red') $$,
  'P0001', 'item_locked', '買っていないほっぺは使えない');
select is(public.buy_item('cheeks:usupink'), 0, 'うすピンクのほっぺ（5）を買うと0コイン');
select throws_ok($$ select public.save_avatar('shiro', 'nosuch', 'omega', 'pink', 'none', 'none', 'red') $$,
  'P0001', 'invalid_avatar', '存在しない目は保存できない');

select * from finish();
rollback;
