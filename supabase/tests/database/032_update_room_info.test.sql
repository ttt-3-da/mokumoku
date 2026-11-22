-- 部屋の情報を RPC で変える pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000032a1', 'ria@users.mokumoku.invalid', '{"username":"ria"}'),
  ('00000000-0000-0000-0000-0000000032b2', 'rib@users.mokumoku.invalid', '{"username":"rib"}');
insert into public.rooms (id, owner_id, name) values ('32000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000032a1', 'もとの名前');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000032b2","role":"authenticated"}', true);
select throws_ok($$ select public.update_room_info('32000000-0000-0000-0000-000000000001', '乗っ取り', '', '📚', '{}') $$, 'P0001', 'forbidden', 'オーナーでない人は変えられない');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000032a1","role":"authenticated"}', true);
select lives_ok($$ select public.update_room_info('32000000-0000-0000-0000-000000000001', '新しい名前', '新しい説明', '☕', array['数学']) $$, 'オーナーは変えられる');
select throws_ok($$ select public.update_room_info('32000000-0000-0000-0000-000000000001', '', '', '☕', '{}') $$, '23514', null, '空の名前にはできない');
reset role;
select is((select description from public.rooms where id = '32000000-0000-0000-0000-000000000001'), '新しい説明', '説明が保存される');

select * from finish();
rollback;
