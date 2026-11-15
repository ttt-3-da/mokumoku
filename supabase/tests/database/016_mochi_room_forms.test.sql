-- もちの部屋とフォルムの pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000016a1', 'mr1@users.mokumoku.invalid', '{"username":"mr1"}');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}', true);

select throws_ok($$ select public.set_avatar_form('king') $$, 'P0001', 'item_locked', '買っていない形にはできない');
select lives_ok($$ select public.save_mochi_room('sakura', '[{"id":"plant","x":20,"y":60},{"id":"rug","x":50,"y":85}]') $$, '無料の壁紙と家具で保存できる');
select throws_ok($$ select public.save_mochi_room('night', '[]') $$, 'P0001', 'item_locked', '買っていない壁紙は使えない');
select throws_ok($$ select public.save_mochi_room('cream', '[{"id":"bed","x":20,"y":60}]') $$, 'P0001', 'item_locked', '買っていない家具は置けない');
select is((public.get_mochi_room('mr1') -> 'items' -> 0 ->> 'id'), 'plant', '部屋を読める');

select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
insert into public.owned_items (user_id, item_id) values ('00000000-0000-0000-0000-0000000016a1', 'form:king');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}', true);
select is((public.set_avatar_form('king') ->> 'form'), 'king', '買った形にできる');

select * from finish();
rollback;
