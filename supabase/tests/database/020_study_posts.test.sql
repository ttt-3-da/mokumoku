-- 勉強の記録の投稿・タイムライン・もちスタンプの反応の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- E2E で作られた投稿が残っていても数がずれないように（最後に rollback するので元に戻る）
delete from public.posts;

update public.badge_defs set coins = 0;
alter table public.follows disable trigger follows_badge;
alter table public.rooms disable trigger rooms_badge;

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- a：投稿する人 / b：フォローしている人 / c：フォローしていない人
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000020a1', 'pa@users.mokumoku.invalid', '{"username":"post_a"}'),
  ('00000000-0000-0000-0000-0000000020b1', 'pb@users.mokumoku.invalid', '{"username":"post_b"}'),
  ('00000000-0000-0000-0000-0000000020c1', 'pc@users.mokumoku.invalid', '{"username":"post_c"}');
insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes, is_persistent)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000020a1', '投稿の部屋', 'public', 'free', 25, 5, true);
insert into public.study_sessions (id, room_id, user_id, task, started_at, ended_at) values
  ('20000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000020a1', '英語',
   now() - interval '90 minutes', now() - interval '30 minutes'),
  ('20000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000020a1', '数学',
   now() - interval '20 minutes', null);
insert into public.todos (user_id, title, done_at) values ('00000000-0000-0000-0000-0000000020a1', '単語', now() - interval '60 minutes');
insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-0000000020b1', '00000000-0000-0000-0000-0000000020a1');

-- ---------------------------------------------------------------- 投稿する
select pg_temp.login('00000000-0000-0000-0000-0000000020a1');
select throws_ok($$ select public.create_post('20000000-0000-0000-0000-0000000000a2', '') $$, 'P0001', 'session_not_ended', 'まだ勉強中の記録は投稿できない');
select lives_ok($$ select public.create_post('20000000-0000-0000-0000-0000000000a1', '長文がんばった') $$, '退室した記録は投稿できる');
select throws_ok($$ select public.create_post('20000000-0000-0000-0000-0000000000a1', '') $$, 'P0001', 'already_posted', '同じ記録は1回だけ');
select is((select minutes from public.list_posts('following')), 60, '勉強した時間が出る');
select is((select todos_done from public.list_posts('following')), 1, 'そのあいだに終わらせたToDoの数が出る');

select pg_temp.login('00000000-0000-0000-0000-0000000020c1');
select throws_ok($$ select public.create_post('20000000-0000-0000-0000-0000000000a1', '') $$, 'P0001', 'session_not_found', 'ほかの人の記録は投稿できない');

-- ---------------------------------------------------------------- 見える範囲
select is((select count(*)::int from public.list_posts('following')), 0, 'フォローしていない人の投稿は「フォロー中」に出ない');
select is((select count(*)::int from public.list_posts('all')), 1, '「みんな」には出る');
select pg_temp.login('00000000-0000-0000-0000-0000000020b1');
select is((select count(*)::int from public.list_posts('following')), 1, 'フォローしている人の投稿は「フォロー中」に出る');

-- ---------------------------------------------------------------- もちスタンプ
select throws_ok($$ select public.toggle_post_reaction((select id from public.list_posts('all') limit 1), 'coffee') $$, 'P0001', 'invalid_stamp',
  '決まった4つ以外のスタンプは送れない');
select is(public.toggle_post_reaction((select id from public.list_posts('all') limit 1), 'clap'), true, 'ぱちぱちを送れる');
select is((select (reactions -> 0 ->> 'count')::int from public.list_posts('all')), 1, '数が出る');
select is(public.toggle_post_reaction((select id from public.list_posts('all') limit 1), 'clap'), false, 'もう一度押すと取り消せる');
select lives_ok($$ select public.toggle_post_reaction((select id from public.list_posts('all') limit 1), 'wow') $$, 'べつのスタンプも送れる');
select pg_temp.logout();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000020a1' and kind = 'post_reaction'), 1,
  '同じ人から同じ投稿へのお知らせは1件にまとまる');

-- ---------------------------------------------------------------- ブロック・非公開・削除
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000020c1');
select pg_temp.login('00000000-0000-0000-0000-0000000020c1');
select is((select count(*)::int from public.list_posts('all')), 0, 'ブロックされている人には見えない');

select pg_temp.login('00000000-0000-0000-0000-0000000020b1');
select throws_ok($$ select public.delete_post((select id from public.list_posts('all') limit 1)) $$, 'P0001', 'post_not_found', 'ほかの人の投稿は消せない');

select * from finish();
rollback;
