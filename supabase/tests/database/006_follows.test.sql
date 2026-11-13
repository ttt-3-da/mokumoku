-- フォロー・通知・いま勉強中・くらべる の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000004a1', 'fol_amy@users.mokumoku.invalid', '{"username":"fol_amy","display_name":"エイミー"}'),
  ('00000000-0000-0000-0000-0000000004b2', 'fol_ben@users.mokumoku.invalid', '{"username":"fol_ben","display_name":"ベン"}'),
  ('00000000-0000-0000-0000-0000000004c3', 'fol_cat@users.mokumoku.invalid', '{"username":"fol_cat","display_name":"キャット"}');
update public.profiles set is_public = false where id = '00000000-0000-0000-0000-0000000004c3';

insert into public.rooms (id, owner_id, name, visibility) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000004b2', '公開の自習室', 'public'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000004b2', 'ひみつの自習室', 'unlisted');

-- ---------------------------------------------------------------- フォロー
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select lives_ok($$ select public.follow_user('fol_ben') $$, 'フォローできる');
select lives_ok($$ select public.follow_user('fol_ben') $$, '2回フォローしてもエラーにならない');
select throws_ok($$ select public.follow_user('fol_cat') $$, 'P0001', 'user_not_found', '非公開の人はフォローできない');
select throws_ok($$ select public.follow_user('fol_amy') $$, 'P0001', 'cannot_follow_self', '自分はフォローできない');
select throws_ok($$ insert into public.follows (follower_id, followee_id)
                    values ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004c3') $$,
  '42501', null, 'follows に直接書き込めない');
select is((public.get_follow_info('fol_ben')) ->> 'followers', '1', 'フォロワー数が数えられる');
select is((public.get_follow_info('fol_ben')) ->> 'is_following', 'true', '自分がフォローしているか分かる');

-- ---------------------------------------------------------------- 通知
select pg_temp.login('00000000-0000-0000-0000-0000000004b2');
select is(public.count_unread_notifications(), 1, 'フォローされると通知が1件届く（2回押しても1件）');
select is((select actor_username from public.list_notifications() limit 1), 'fol_amy', 'だれにフォローされたか分かる');
select is((public.get_follow_info('fol_amy')) ->> 'follows_me', 'true', '相手が自分をフォローしているか分かる');
select lives_ok($$ select public.mark_notifications_read() $$, '既読にできる');
select is(public.count_unread_notifications(), 0, '既読にすると未読は0件');

select pg_temp.login('00000000-0000-0000-0000-0000000004c3');
select lives_ok($$ select public.follow_user('fol_ben') $$, '非公開の人も、ほかの人はフォローできる');
select pg_temp.login('00000000-0000-0000-0000-0000000004b2');
select is((select count(*)::int from public.list_follows('fol_ben', 'followers')), 1, 'フォロワー一覧に非公開の人は出ない');
select is(public.count_unread_notifications(), 0, '非公開の人からのフォロー通知は数えない');

-- ---------------------------------------------------------------- いま勉強中
select public.enter_room('50000000-0000-0000-0000-000000000001', '英単語');
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select is((select room_name from public.list_following_activity() where username = 'fol_ben'), '公開の自習室',
  '公開部屋なら、フォロー中の人がいる部屋名が分かる');

select pg_temp.login('00000000-0000-0000-0000-0000000004b2');
select public.enter_room('50000000-0000-0000-0000-000000000002', 'ひみつ', (select invite_code from public.rooms where id = '50000000-0000-0000-0000-000000000002'));
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select is((select room_name is null and task is null from public.list_following_activity() where username = 'fol_ben'), true,
  '限定部屋にいるときは「勉強中」だけで、部屋名も今やることも出さない');

-- ---------------------------------------------------------------- くらべる
select pg_temp.logout();
insert into public.study_sessions (room_id, user_id, task, started_at, ended_at)
values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000004a1', '数学',
        now() - interval '90 minutes', now() - interval '30 minutes');
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select is((select count(*)::int from public.follow_leaderboard()), 2, 'くらべるには自分とフォロー中の人が出る');
select is((select week_minutes from public.follow_leaderboard() where is_me), 60, '自分の今週の学習時間が出る');

select pg_temp.login('00000000-0000-0000-0000-0000000004b2');
update public.profiles set stats_public = false where id = '00000000-0000-0000-0000-0000000004b2';
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select is((select count(*)::int from public.follow_leaderboard()), 1, '統計を隠している人はくらべるに出ない');

select * from finish();
rollback;
