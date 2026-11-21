-- ToDo のチェック（RPC）と、運営の「確認しました」の印 pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000030a1', 'tca@users.mokumoku.invalid', '{"username":"tca"}'),
  ('00000000-0000-0000-0000-0000000030b2', 'tcb@users.mokumoku.invalid', '{"username":"tcb"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000030a1';
insert into public.rooms (id, owner_id, name) values ('00000000-0000-0000-0000-0000000030c3', '00000000-0000-0000-0000-0000000030b2', 'r');
insert into public.study_sessions (id, user_id, room_id, task, started_at, ended_at)
  values ('00000000-0000-0000-0000-0000000030d4', '00000000-0000-0000-0000-0000000030b2', '00000000-0000-0000-0000-0000000030c3', '数学', now() - interval '1 hour', now());
insert into public.posts (id, user_id, session_id, body)
  values ('00000000-0000-0000-0000-0000000030e5', '00000000-0000-0000-0000-0000000030b2', '00000000-0000-0000-0000-0000000030d4', '見てください');
insert into public.todos (id, user_id, title) values ('00000000-0000-0000-0000-0000000030f6', '00000000-0000-0000-0000-0000000030b2', '英単語');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030b2","role":"authenticated"}', true);
select ok(public.set_todo_done('00000000-0000-0000-0000-0000000030f6', true) is not null, 'チェックをつけると終わった時刻が返る');
select ok((select done_at from public.todos where id = '00000000-0000-0000-0000-0000000030f6') is not null, 'チェックが保存される');
select ok(public.set_todo_done('00000000-0000-0000-0000-0000000030f6', false) is null, 'チェックをはずせる');
select throws_ok($$ select public.admin_set_post_checked('00000000-0000-0000-0000-0000000030e5', true) $$, 'P0001', 'admin_only', '運営でない人は印をつけられない');
select is((select staff_checked from public.list_posts('all') where id = '00000000-0000-0000-0000-0000000030e5'), false, 'はじめは印がない');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}', true);
select throws_ok($$ select public.set_todo_done('00000000-0000-0000-0000-0000000030f6', true) $$, 'P0001', 'todo_not_found', 'ほかの人のToDoはチェックできない');
select ok(public.admin_set_post_checked('00000000-0000-0000-0000-0000000030e5', true), '運営は印をつけられる');
select is((select staff_checked from public.list_posts('all') where id = '00000000-0000-0000-0000-0000000030e5'), true, 'みんなに印が見える');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030b2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_notifications() where kind = 'post_checked'), 1, '投稿した人にお知らせが1件届く');

select * from finish();
rollback;
