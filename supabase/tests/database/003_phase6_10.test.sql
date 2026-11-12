-- フェーズ6〜10（アバター・招待・承認・タイマー同期・ハートビート・後処理）の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001a1', 'p6owner@users.mokumoku.invalid', '{"username":"p6owner"}'),
  ('00000000-0000-0000-0000-0000000001b2', 'p6bob@users.mokumoku.invalid',   '{"username":"p6bob"}'),
  ('00000000-0000-0000-0000-0000000001c3', 'p6carol@users.mokumoku.invalid', '{"username":"p6carol"}');

insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000001a1', '限定', 'unlisted', 'pomodoro', 25, 5),
       ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000001a1', '承認制', 'approval', 'free', 25, 5);
update public.rooms set invite_code = 'test-invite-1' where id = '20000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------- フェーズ6：アバター
select is((select color from public.avatars where user_id = '00000000-0000-0000-0000-0000000001b2'), 'shiro',
  'サインアップでデフォルトのもちが作られる');

select pg_temp.login('00000000-0000-0000-0000-0000000001b2');
select is((public.save_avatar('yuzu', 'glasses', 'smile', 'orange', 'ribbon', 'none', 'red')) ->> 'color', 'yuzu',
  '解放不要のパーツは保存できる');
select throws_ok($$ select public.save_avatar('yuzu', 'dot', 'smile', 'none', 'leaf', 'none', 'red') $$,
  'P0001', 'item_locked', '解放していない頭の小物は使えない');
select throws_ok($$ select public.save_avatar('yuzu', 'dot', 'smile', 'none', 'none', 'mug', 'red') $$,
  'P0001', 'item_locked', '解放していない机の小物は使えない');
select throws_ok($$ select public.save_avatar('rainbow', 'dot', 'smile', 'none', 'none', 'none', 'red') $$,
  'P0001', 'invalid_avatar', '存在しない色は保存できない');
select throws_ok($$ update public.avatars set head = 'crown' where user_id = '00000000-0000-0000-0000-0000000001b2' $$,
  '42501', null, 'avatars を直接更新できない');
select throws_ok($$ insert into public.unlocks (user_id, item_id) values ('00000000-0000-0000-0000-0000000001b2', 'head:crown') $$,
  '42501', null, 'unlocks を自分で追加できない');
select pg_temp.logout();

insert into public.unlocks (user_id, item_id) values ('00000000-0000-0000-0000-0000000001b2', 'desk:mug');
select pg_temp.login('00000000-0000-0000-0000-0000000001b2');
select is((public.save_avatar('yuzu', 'dot', 'smile', 'none', 'none', 'mug', 'red')) ->> 'desk', 'mug',
  '解放したアイテムは使える');

-- ---------------------------------------------------------------- フェーズ8：招待・承認
select is(public.get_room_by_invite('test-invite-1'), '20000000-0000-0000-0000-000000000001'::uuid,
  '招待コードから限定部屋を引ける');
select is(public.get_room_by_invite('wrong-code'), null, '間違った招待コードでは引けない');
select is(public.get_room_preview('20000000-0000-0000-0000-000000000001'), null,
  '招待コードなしでは限定部屋のプレビューは見えない');
select isnt(public.get_room_preview('20000000-0000-0000-0000-000000000001', 'test-invite-1'), null,
  '招待コードがあればプレビューが見える');
select is((public.get_room_preview('20000000-0000-0000-0000-000000000001', 'test-invite-1')) ->> 'invite_code', null,
  'スタッフ以外には招待コードを返さない');
select is((select count(*)::int from public.list_public_rooms() where id = '20000000-0000-0000-0000-000000000002'), 1,
  '承認制の部屋はロビーに出る');

select is((public.enter_room('20000000-0000-0000-0000-000000000002', '申請')) ->> 'status', 'pending', '承認制は申請になる');
select throws_ok($$ select public.approve_member('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000001b2') $$,
  'P0001', 'forbidden', 'メンバーは承認できない');

select pg_temp.login('00000000-0000-0000-0000-0000000001a1');
select is((select count(*)::int from public.list_pending_members('20000000-0000-0000-0000-000000000002')), 1,
  'オーナーは申請一覧を見られる');
select lives_ok($$ select public.approve_member('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000001b2') $$,
  'オーナーは承認できる');

select pg_temp.login('00000000-0000-0000-0000-0000000001b2');
select is((public.enter_room('20000000-0000-0000-0000-000000000002', '承認された')) ->> 'status', 'entered',
  '承認されたら入室できる');

-- ---------------------------------------------------------------- フェーズ9：タイマー
select throws_ok($$ select public.start_timer('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'forbidden', 'メンバーはタイマーを開始できない');
select pg_temp.login('00000000-0000-0000-0000-0000000001a1');
select throws_ok($$ select public.start_timer('20000000-0000-0000-0000-000000000002') $$,
  'P0001', 'not_pomodoro_room', '自由モードの部屋ではタイマーを開始できない');

-- オーナーが限定部屋に2時間前から入室していて、タイマーも2時間前に始まっていたことにする
select public.enter_room('20000000-0000-0000-0000-000000000001', '設計');
select pg_temp.logout();
update public.study_sessions set started_at = now() - interval '2 hours', last_seen_at = now()
where user_id = '00000000-0000-0000-0000-0000000001a1' and ended_at is null;
update public.rooms set timer_started_at = now() - interval '2 hours' where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.login('00000000-0000-0000-0000-0000000001a1');
select isnt(public.start_timer('20000000-0000-0000-0000-000000000001'), null, 'オーナーはタイマーを開始できる');
select pg_temp.logout();
select is((select pomodoros from public.study_sessions
           where user_id = '00000000-0000-0000-0000-0000000001a1' and ended_at is null), 4,
  'やり直す前のポモドーロ（2時間で4回）がセッションに残る');

-- ---------------------------------------------------------------- フェーズ10：ハートビートと後処理
select pg_temp.login('00000000-0000-0000-0000-0000000001a1');
select is((public.heartbeat('レビュー')) ->> 'room_id', '20000000-0000-0000-0000-000000000001', 'ハートビートが届く');
select is((select task from public.study_sessions
           where user_id = '00000000-0000-0000-0000-0000000001a1' and ended_at is null), 'レビュー',
  'ハートビートで今やることも保存される');

select pg_temp.login('00000000-0000-0000-0000-0000000001c3');
select throws_ok($$ select public.heartbeat() $$, 'P0001', 'no_active_session', '入室していなければエラー');
select pg_temp.logout();

-- bob の最後のハートビートが5分前だったことにして後処理を走らせる
update public.study_sessions set started_at = now() - interval '30 minutes', last_seen_at = now() - interval '5 minutes'
where user_id = '00000000-0000-0000-0000-0000000001b2' and ended_at is null;
select public.cleanup_stale_sessions();
select is((select ended_at = last_seen_at from public.study_sessions
           where user_id = '00000000-0000-0000-0000-0000000001b2' order by started_at desc limit 1), true,
  '3分以上ハートビートがないセッションは last_seen_at で閉じられる');

select * from finish();
rollback;
