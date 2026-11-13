-- フェーズ11〜13（モデレーション・統計と解放・テーマ）の pgTAP テスト
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
  ('00000000-0000-0000-0000-0000000002a1', 'm11owner@users.mokumoku.invalid', '{"username":"m11owner"}'),
  ('00000000-0000-0000-0000-0000000002b2', 'm11mod@users.mokumoku.invalid',   '{"username":"m11mod"}'),
  ('00000000-0000-0000-0000-0000000002c3', 'm11carol@users.mokumoku.invalid', '{"username":"m11carol"}'),
  ('00000000-0000-0000-0000-0000000002d4', 'm11dave@users.mokumoku.invalid',  '{"username":"m11dave"}');

insert into public.rooms (id, owner_id, name, tags)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002a1', 'モデレーション部屋', '{英語,資格}');

-- ---------------------------------------------------------------- NGワード
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select throws_ok($$ insert into public.rooms (owner_id, name) values ('00000000-0000-0000-0000-0000000002a1', '死ね部屋') $$,
  'P0001', 'ng_word', 'NGワードを含む部屋名は作れない');
select throws_ok($$ insert into public.rooms (owner_id, name, description)
                    values ('00000000-0000-0000-0000-0000000002a1', 'ふつう', 'Ｆ ｕ ｃ ｋ') $$,
  'P0001', 'ng_word', '全角やスペースで分けても説明文のNGワードは見つかる');
select throws_ok($$ update public.rooms set name = '副業で稼げる部屋' where id = '30000000-0000-0000-0000-000000000001' $$,
  'P0001', 'ng_word', '部屋名をNGワードに変更することもできない');
select lives_ok($$ insert into public.rooms (owner_id, name) values ('00000000-0000-0000-0000-0000000002a1', '英単語ばかりがんばる') $$,
  'NGワードがなければ作れる（「ばかり」のような普通の言葉には反応しない）');
select throws_ok($$ select * from public.ng_words $$, '42501', null, 'NGワードの一覧はクライアントから読めない');

-- ---------------------------------------------------------------- 入室してモデレーター任命
select public.enter_room('30000000-0000-0000-0000-000000000001', '管理');
select pg_temp.login('00000000-0000-0000-0000-0000000002b2');
select public.enter_room('30000000-0000-0000-0000-000000000001', 'モデレーター');
select pg_temp.login('00000000-0000-0000-0000-0000000002c3');
select public.enter_room('30000000-0000-0000-0000-000000000001', 'キャロル');

select throws_ok($$ select public.set_moderator('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002b2', true) $$,
  'P0001', 'owner_only', 'オーナー以外はモデレーターを任命できない');
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select lives_ok($$ select public.set_moderator('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002b2', true) $$,
  'オーナーはモデレーターを任命できる');
select is((select count(*)::int from public.list_room_roles('30000000-0000-0000-0000-000000000001')), 2,
  '在室者はオーナーとモデレーターの一覧を見られる');

-- ---------------------------------------------------------------- キック・BAN
select pg_temp.login('00000000-0000-0000-0000-0000000002c3');
select throws_ok($$ select public.kick_member('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002b2') $$,
  'P0001', 'forbidden', 'メンバーはキックできない');

select pg_temp.login('00000000-0000-0000-0000-0000000002b2');
select throws_ok($$ select public.ban_member('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002a1') $$,
  'P0001', 'cannot_target_owner', 'オーナーは BAN できない');
select lives_ok($$ select public.kick_member('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002c3') $$,
  'モデレーターはキックできる');
select is((select count(*)::int from public.study_sessions
           where user_id = '00000000-0000-0000-0000-0000000002c3' and ended_at is null), 0,
  'キックされた人のセッションは閉じられる');
select throws_ok($$ select public.kick_member('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002c3') $$,
  'P0001', 'not_in_room', '部屋にいない人はキックできない');

select pg_temp.login('00000000-0000-0000-0000-0000000002c3');
select is((public.enter_room('30000000-0000-0000-0000-000000000001', '戻ってきた')) ->> 'status', 'entered',
  'キックのあとは入り直せる');

select pg_temp.login('00000000-0000-0000-0000-0000000002b2');
select lives_ok($$ select public.ban_member('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002c3') $$,
  'モデレーターは BAN できる');
select pg_temp.login('00000000-0000-0000-0000-0000000002c3');
select throws_ok($$ select public.enter_room('30000000-0000-0000-0000-000000000001', 'もう一回') $$,
  'P0001', 'banned', 'BAN された人は入室できない');
select throws_ok($$ insert into public.room_bans (room_id, user_id) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002d4') $$,
  '42501', null, 'room_bans に直接書き込めない');

select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select is((select count(*)::int from public.list_room_bans('30000000-0000-0000-0000-000000000001')), 1, 'BAN の一覧を見られる');
select lives_ok($$ select public.unban_member('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002c3') $$,
  'BAN を解除できる');

-- ---------------------------------------------------------------- 通報
select pg_temp.login('00000000-0000-0000-0000-0000000002d4');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
                   values ('00000000-0000-0000-0000-0000000002d4', 'room', '30000000-0000-0000-0000-000000000001', '迷惑行為') $$,
  '部屋を通報できる');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id)
                    values ('00000000-0000-0000-0000-0000000002d4', 'room', '30000000-0000-0000-0000-000000000001') $$,
  '23505', null, '同じ相手は2回通報できない');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id)
                    values ('00000000-0000-0000-0000-0000000002a1', 'user', '00000000-0000-0000-0000-0000000002d4') $$,
  '42501', null, '他人になりすまして通報できない');
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select is((select count(*)::int from public.reports), 0, 'ほかの人の通報は見えない');

-- ---------------------------------------------------------------- 統計と解放
-- オーナーが12時間勉強していたことにして退室する
select pg_temp.logout();
update public.study_sessions set started_at = now() - interval '12 hours'
where user_id = '00000000-0000-0000-0000-0000000002a1' and ended_at is null;
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select is((select array(select jsonb_array_elements_text(public.leave_room() -> 'unlocked') order by 1)),
          array['desk:mug', 'head:leaf'], '退室時に葉っぱ（初めての入室）とマグカップ（累計10時間）が解放される');

select is(((public.get_profile_stats('m11owner')) ->> 'total_minutes')::int, 720, '累計時間が統計に出る');
select is((select count(*)::int from jsonb_array_elements((public.get_profile_stats('m11owner')) -> 'tags') e
           where e ->> 'tag' in ('英語', '資格') and (e ->> 'minutes')::int = 360), 2,
  'タグ別の時間は、部屋のタグで等分する');

-- ---------------------------------------------------------------- テーマ
select lives_ok($$ update public.rooms set theme = 'cafe' where id = '30000000-0000-0000-0000-000000000001' $$,
  'オーナーはテーマを変えられる');

select * from finish();
rollback;
