-- `npm run db:test`（supabase test db）で実行する pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- ---------------------------------------------------------------- helpers
create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@users.mokumoku.invalid', '{"username":"owner","display_name":"オーナー"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@users.mokumoku.invalid',   '{"username":"bob"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@users.mokumoku.invalid', '{"username":"carol"}');

-- 開発中の DB に他のデータがあっても通るよう、このテストで作ったものだけを数える
select is((select count(*)::int from public.profiles where username in ('owner', 'bob', 'carol')), 3,
  'サインアップでプロフィールが作られる');
select is((select display_name from public.profiles where username = 'bob'), 'bob', '表示名が空ならユーザーIDを使う');

-- ---------------------------------------------------------------- profiles RLS
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
update public.profiles set display_name = 'のっとり' where username = 'owner';
select pg_temp.logout();
select is((select display_name from public.profiles where username = 'owner'), 'オーナー', '他人のプロフィールは更新できない');

select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ update public.profiles set username = 'bob2' where username = 'bob' $$,
  '42501', null, 'username は変更できない（列権限）');
select pg_temp.logout();

-- ---------------------------------------------------------------- rooms
-- クライアントは id を指定できない（列権限）ので、オーナー本人として id なしで作れることだけ確認し、
-- テスト用の部屋は id を固定したいので管理者として作る
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ insert into public.rooms (owner_id, name)
                   values ('00000000-0000-0000-0000-0000000000a1', 'オーナーが作る部屋') $$,
  'オーナー本人なら部屋を作れる');
select pg_temp.logout();
delete from public.rooms where name = 'オーナーが作る部屋';

insert into public.rooms (id, owner_id, name, capacity, is_persistent)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '定員2の部屋', 2, false);
insert into public.rooms (id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', '限定の部屋', 'unlisted'),
       ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', '承認制の部屋', 'approval');

select is((select role::text from public.room_members
           where room_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000a1'),
          'owner', '作成者はオーナーとして登録される');

select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ insert into public.rooms (owner_id, name)
                    values ('00000000-0000-0000-0000-0000000000a1', 'なりすまし') $$,
  '42501', null, '他人をオーナーにした部屋は作れない');
select is((select count(*)::int from public.rooms where id = '10000000-0000-0000-0000-000000000002'), 0,
  '限定部屋は一覧（RLS）から見えない');
select is((select array_agg(name order by name) from public.list_public_rooms()
           where id::text like '10000000-%'),
          array['定員2の部屋', '承認制の部屋'], 'ロビーには公開部屋と承認制の部屋だけが出る（限定部屋は出ない）');
select throws_ok($$ update public.rooms set invite_code = 'x' where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'invite_code はクライアントから更新できない');

-- ---------------------------------------------------------------- enter_room
select is((public.enter_room('10000000-0000-0000-0000-000000000001', '英単語')) ->> 'status', 'entered', '公開部屋に入室できる');
select is((public.enter_room('10000000-0000-0000-0000-000000000001', '長文読解')) ->> 'resumed', 'true',
  '同じ部屋に入り直すと既存セッションを続ける');
select is((select count(*)::int from public.study_sessions where ended_at is null), 1, '未終了セッションは1つだけ');
select throws_ok($$ select public.enter_room('10000000-0000-0000-0000-000000000001', '   ') $$,
  'P0001', 'invalid_task', 'やることが空なら入室できない');
select throws_ok($$ select public.enter_room('10000000-0000-0000-0000-000000000002', 'x') $$,
  'P0001', 'invite_required', '限定部屋は招待コードなしでは入れない');
select is((public.enter_room('10000000-0000-0000-0000-000000000003', 'x')) ->> 'status', 'pending',
  '承認制の部屋は申請になる');
select is((select status::text from public.room_members
           where room_id = '10000000-0000-0000-0000-000000000003' and user_id = '00000000-0000-0000-0000-0000000000b2'),
          'pending', '申請は room_members に pending で残る');
select throws_ok($$ insert into public.study_sessions (room_id, user_id, task)
                    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'x') $$,
  '42501', null, 'study_sessions に直接 insert できない');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((public.enter_room('10000000-0000-0000-0000-000000000001', '設計')) ->> 'status', 'entered', 'オーナーも入室');
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select public.enter_room('10000000-0000-0000-0000-000000000001', 'x') $$,
  'P0001', 'room_full', '定員を超えると入室できない');

-- ---------------------------------------------------------------- leave_room / create_post
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select is((public.leave_room()) ->> 'minutes', '0', '退室すると学習分数が返る');
select is((select count(*)::int from public.list_my_sessions()), 0, '1分未満のセッションは記録の一覧に出ない');

-- 2時間前に入室したことにして、投稿できるか確認
select pg_temp.logout();
update public.study_sessions set started_at = now() - interval '2 hours', last_seen_at = now() - interval '2 hours'
where user_id = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.list_my_sessions()), 1, '1分以上なら自動で記録に残る');
select lives_ok($$ select public.set_session_note((select id from public.study_sessions limit 1), 'がんばった') $$,
  '記録にメモを付けられる');
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.list_my_sessions()), 0, 'ほかの人の記録は見えない');
select throws_ok($$ select public.set_session_note(
                      (select id from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000000b2'
                       limit 1), 'のっとり') $$,
  'P0001', 'session_not_found', 'ほかの人の記録にメモを付けられない');

-- オーナーも退室 → 一時部屋が閉じる
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select public.leave_room();
select pg_temp.logout();
select isnt((select closed_at from public.rooms where id = '10000000-0000-0000-0000-000000000001'), null,
  '一時部屋は最後の1人が退室すると閉じる');

select * from finish();
rollback;
