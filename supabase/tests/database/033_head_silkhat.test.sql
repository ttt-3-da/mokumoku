begin;
select plan(3);

select is((select price from public.shop_items where item_id = 'head:silkhat'), 100, '紳士のハットは🪙100');
select is((select kind from public.shop_items where item_id = 'head:silkhat'), 'head', '頭の小物として売る');

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'avatars_head_check') like '%silkhat%',
  'アバターの頭に silkhat を入れられる'
);

select * from finish();
rollback;
