-- ブロック・ToDo・もちの部屋のスタンプの pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000018a1', 'bt1@users.mokumoku.invalid', '{"username":"bt1"}'),
  ('00000000-0000-0000-0000-0000000018a2', 'bt2@users.mokumoku.invalid', '{"username":"bt2"}'),
  ('00000000-0000-0000-0000-0000000018a3', 'bt3@users.mokumoku.invalid', '{"username":"bt3"}');
update public.profiles set is_public = true where username in ('bt1', 'bt2', 'bt3');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated"}', true);

-- ---- もちの部屋のスタンプ
select lives_ok($$ select public.leave_mochi_stamp('bt2', 'clap', 30, 60) $$, '無料のスタンプを置ける');
select throws_ok($$ select public.leave_mochi_stamp('bt2', 'clap', 40, 60) $$, 'P0001', 'too_fast', '続けては置けない');
select throws_ok($$ select public.leave_mochi_stamp('bt3', 'crown', 40, 60) $$, 'P0001', 'item_locked', '買っていないスタンプは置けない');
select throws_ok($$ select public.leave_mochi_stamp('bt1', 'clap', 40, 60) $$, 'P0001', 'cannot_stamp_self', '自分の部屋には置けない');
select is(jsonb_array_length(public.get_mochi_room('bt2') -> 'stamps'), 1, '部屋にスタンプが残る');

-- ---- ToDo
insert into public.todos (title) values ('英単語 30 個'), ('数学の宿題');
update public.todos set done_at = now() where title = '英単語 30 個';
select is((select count(*)::int from public.todos where done_at is not null), 1, '終わったものは残る');
select throws_ok($$ insert into public.todos (title) values ('   ') $$, '23514', null, '空のやることは作れない');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a2","role":"authenticated"}', true);
select is((select count(*)::int from public.todos), 0, 'ほかの人のやることは見えない');
select is((select count(*)::int from public.list_notifications() where kind = 'mochi_stamp'), 1, 'スタンプを置かれたらお知らせが届く');

-- ---- ブロック
select public.follow_user('bt1');
select public.block_user('bt1');
select is((select count(*)::int from public.follows where follower_id = '00000000-0000-0000-0000-0000000018a2'), 0, 'ブロックするとフォローが外れる');
select is((select count(*)::int from public.list_notifications() where kind = 'mochi_stamp'), 0, 'ブロックした人からのお知らせは出ない');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated"}', true);
select throws_ok($$ select public.follow_user('bt2') $$, 'P0001', 'blocked', 'ブロックされているとフォローできない');
select is(public.get_mochi_room('bt2'), null, 'ブロックされていると部屋に行けない');
select is((select count(*)::int from public.search_users('bt2')), 0, 'ブロックされていると検索に出ない');

select * from finish();
rollback;
