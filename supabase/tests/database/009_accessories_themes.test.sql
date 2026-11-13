-- ショップ3回目・4回目（アクセサリー・部屋のテーマ）の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007a1', 'acc_amy2@users.mokumoku.invalid', '{"username":"acc_amy2"}');

select is((select count(*)::int from public.shop_items where kind in ('head', 'neck', 'desk')), 30, 'アクセサリーが30種売られている');
select is((select count(*)::int from public.shop_items where kind = 'theme'), 17, 'テーマは今ある2つ＋新しく15');

select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select is(public.buy_item('neck:choutie'), 5, 'ちょうネクタイ（25）を買うと残り5コイン');
select is((public.save_avatar('shiro', 'dot', 'omega', 'pink', 'ribbon', 'none', 'red', 'choutie')) ->> 'neck', 'choutie',
  '頭の小物（リボン）と首の小物を同時に付けられる');
select is((public.avatar_json('00000000-0000-0000-0000-0000000007a1')) ->> 'head', 'ribbon', 'アバターの JSON に頭の小物が残る');
select throws_ok($$ select public.save_avatar('shiro', 'dot', 'omega', 'pink', 'nekomimi', 'none', 'red', 'none') $$,
  'P0001', 'item_locked', '買っていない頭の小物は使えない');
select throws_ok($$ select public.save_avatar('shiro', 'dot', 'omega', 'pink', 'none', 'kingyo', 'red', 'none') $$,
  'P0001', 'item_locked', '買っていない机の小物は使えない');
select throws_ok($$ insert into public.rooms (owner_id, name, theme) values ('00000000-0000-0000-0000-0000000007a1', '水族館の部屋', 'aquarium') $$,
  'P0001', 'theme_locked', '新しいテーマも🍅で買うまで使えない');

select * from finish();
rollback;
