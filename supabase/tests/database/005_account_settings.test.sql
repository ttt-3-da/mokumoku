-- 退会・公開範囲・自己紹介・ユーザー検索・部屋の削除と一斉退出の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003a1', 'acc_owner@users.mokumoku.invalid', '{"username":"acc_owner","display_name":"部屋主"}'),
  ('00000000-0000-0000-0000-0000000003b2', 'acc_bob@users.mokumoku.invalid',   '{"username":"acc_bob","display_name":"ボブ"}'),
  ('00000000-0000-0000-0000-0000000003c3', 'acc_hide@users.mokumoku.invalid',  '{"username":"acc_hide","display_name":"かくれ"}');

insert into public.rooms (id, owner_id, name)
values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003a1', '削除される部屋'),
       ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000003a1', '退会で閉じる部屋');

-- ---------------------------------------------------------------- 自己紹介・公開範囲
select pg_temp.login('00000000-0000-0000-0000-0000000003c3');
select lives_ok($$ update public.profiles set bio = 'よろしく', is_public = false
                   where id = '00000000-0000-0000-0000-0000000003c3' $$, '自己紹介と公開範囲を変えられる');
select throws_ok($$ update public.profiles set bio = repeat('あ', 501) where id = '00000000-0000-0000-0000-0000000003c3' $$,
  '23514', null, '自己紹介は500文字まで');
select throws_ok($$ update public.profiles set bio = '副業で稼げる' where id = '00000000-0000-0000-0000-0000000003c3' $$,
  'P0001', 'ng_word_profile', '自己紹介にもNGワードが効く');
select is((select count(*)::int from public.profiles where username = 'acc_hide'), 1, '本人は非公開でも自分のプロフィールを読める');

select pg_temp.login('00000000-0000-0000-0000-0000000003b2');
select is((select count(*)::int from public.profiles where username = 'acc_hide'), 0, '非公開のプロフィールはほかの人に見えない');
select is((select count(*)::int from public.search_users('acc')), 2, '検索は公開している人だけ（acc_owner と acc_bob）');
select is((select count(*)::int from public.search_users('かくれ')), 0, '非公開の人は表示名でも検索に出ない');
select is(public.get_profile_stats('acc_hide'), null, '非公開の人の統計は返さない');

select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
update public.profiles set stats_public = false where id = '00000000-0000-0000-0000-0000000003a1';
select isnt(public.get_profile_stats('acc_owner'), null, '統計を隠していても本人には返す');
select pg_temp.login('00000000-0000-0000-0000-0000000003b2');
select is(public.get_profile_stats('acc_owner'), null, '統計を隠している人の統計はほかの人に返さない');
select is((select count(*)::int from public.profiles where username = 'acc_owner'), 1, '統計を隠していてもプロフィールは見える');

-- ---------------------------------------------------------------- 一斉退出・部屋の削除
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
select public.enter_room('40000000-0000-0000-0000-000000000001', '管理');
select pg_temp.login('00000000-0000-0000-0000-0000000003b2');
select public.enter_room('40000000-0000-0000-0000-000000000001', '勉強');

select throws_ok($$ select public.evacuate_room('40000000-0000-0000-0000-000000000001') $$,
  'P0001', 'forbidden', 'メンバーは一斉退出できない');
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
select is(public.evacuate_room('40000000-0000-0000-0000-000000000001'), 1, 'オーナーは自分以外の全員を退室させられる');
select is((select count(*)::int from public.study_sessions
           where room_id = '40000000-0000-0000-0000-000000000001' and ended_at is null), 1, '一斉退出してもオーナーは残る');

select pg_temp.login('00000000-0000-0000-0000-0000000003b2');
select throws_ok($$ select public.delete_room('40000000-0000-0000-0000-000000000001') $$,
  'P0001', 'owner_only', 'オーナー以外は部屋を削除できない');
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
select lives_ok($$ select public.delete_room('40000000-0000-0000-0000-000000000001') $$, 'オーナーは部屋を削除できる');
select is((select count(*)::int from public.study_sessions
           where room_id = '40000000-0000-0000-0000-000000000001' and ended_at is null), 0, '削除すると全員が退室する');
select is(public.get_room_preview('40000000-0000-0000-0000-000000000001'), null, '削除した部屋は入室前画面に出ない');
select pg_temp.logout();
select is((select count(*)::int from public.study_sessions where room_id = '40000000-0000-0000-0000-000000000001'), 2,
  '削除しても記録は残る');
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');

-- ---------------------------------------------------------------- 退会
select public.enter_room('40000000-0000-0000-0000-000000000002', '最後の勉強');
select throws_ok($$ select public.delete_my_account('acc_bob') $$, 'P0001', 'confirm_mismatch', '確認のユーザーIDが違うと退会できない');
select lives_ok($$ select public.delete_my_account('acc_owner') $$, '確認のユーザーIDが合えば退会できる');
select pg_temp.logout();
select is((select owner_id is null and closed_at is not null from public.rooms where id = '40000000-0000-0000-0000-000000000002'), true,
  '退会した人の部屋は、閉じてオーナーなしで残る');

select * from finish();
rollback;
