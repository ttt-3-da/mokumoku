-- 週の目標・実績バッジ・定例の部屋 の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008a1', 'gb_amy@users.mokumoku.invalid', '{"username":"gb_amy"}'),
  ('00000000-0000-0000-0000-0000000008b2', 'gb_ben@users.mokumoku.invalid', '{"username":"gb_ben"}');

insert into public.rooms (id, owner_id, name, timer_mode, focus_minutes, break_minutes) values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000008a1', '目標の部屋', 'pomodoro', 25, 5);

-- ---------------------------------------------------------------- 部屋を作るとバッジ
select ok(exists (select 1 from public.user_badges where user_id = '00000000-0000-0000-0000-0000000008a1' and badge_id = 'room_create'),
  '部屋を作ると「部屋を作った」バッジ');

-- ---------------------------------------------------------------- 週の目標
select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select throws_ok($$ update public.profiles set weekly_goal_minutes = 60 where id = auth.uid() $$,
  '23514', null, '目標は3時間より短くできない');
update public.profiles set weekly_goal_minutes = 180 where id = auth.uid();
select is((public.get_weekly_progress()) ->> 'goal', '180', '目標を3時間にできる');

-- 3時間勉強して退室したことにする
select public.enter_room('80000000-0000-0000-0000-000000000001', '英単語');
select pg_temp.logout();
update public.study_sessions set started_at = greatest(now() - interval '3 hours',
  (public.jst_week_start(public.jst_date(now())) + time '00:00') at time zone 'Asia/Tokyo')
where user_id = '00000000-0000-0000-0000-0000000008a1' and ended_at is null;
update public.rooms set timer_started_at = now() - interval '3 hours' where id = '80000000-0000-0000-0000-000000000001';
select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select public.leave_room();

-- 月曜の早い時間は3時間ぶん取れないので、そのときは目標に届かない
select is((public.get_weekly_progress()) ->> 'achieved',
  case when (select sum(public.session_minutes(started_at, ended_at)) from public.study_sessions
             where user_id = '00000000-0000-0000-0000-0000000008a1') >= 180 then 'true' else 'false' end,
  '目標に届いたら達成になる');
select is((select count(*)::int from public.coin_transactions where user_id = auth.uid() and reason = 'goal'),
  case when (public.get_weekly_progress()) ->> 'achieved' = 'true' then 1 else 0 end,
  '達成したら 🪙20（週に1回）');

-- ---------------------------------------------------------------- 勉強のバッジ
select ok(exists (select 1 from public.user_badges where user_id = auth.uid() and badge_id = 'first_session'), '初めての勉強でバッジ');
select ok(exists (select 1 from public.user_badges where user_id = auth.uid() and badge_id = 'pomo_1'), '初めてのポモドーロでバッジ');
select ok(not exists (select 1 from public.user_badges where user_id = auth.uid() and badge_id = 'total_10h'), 'まだ届かないバッジはもらえない');
select is((select amount from public.coin_transactions where user_id = auth.uid() and detail = 'badge:first_session'), 5,
  'バッジでコインがもらえる');
select ok(exists (select 1 from public.list_notifications() where kind = 'badge' and detail = 'first_session'), 'バッジはお知らせにも出る');
select throws_ok($$ insert into public.user_badges (user_id, badge_id) values (auth.uid(), 'total_300h') $$,
  '42501', null, 'バッジを自分で増やせない');

-- メモを書くとバッジ（2回書いても1回だけ）
select public.set_session_note((select id from public.study_sessions where user_id = auth.uid() limit 1), 'がんばった');
select public.set_session_note((select id from public.study_sessions where user_id = auth.uid() limit 1), 'もっとがんばった');
select is((select count(*)::int from public.coin_transactions where user_id = auth.uid() and detail = 'badge:note_first'), 1,
  'メモのバッジは1回だけ');

-- ---------------------------------------------------------------- 定例の部屋
select pg_temp.login('00000000-0000-0000-0000-0000000008b2');
select throws_ok($$ select public.set_room_schedule('80000000-0000-0000-0000-000000000001', array[1], '07:00') $$,
  'P0001', 'forbidden', 'オーナーでない人は定例を設定できない');

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
-- 30分後に始まる定例にする（今日の曜日）
select public.set_room_schedule('80000000-0000-0000-0000-000000000001',
  array[extract(isodow from now() at time zone 'Asia/Tokyo' + interval '30 minutes')::int],
  (date_trunc('minute', now() at time zone 'Asia/Tokyo') + interval '30 minutes')::time);
select is((select count(*)::int from public.list_upcoming_schedules()), 1, '参加したことのある部屋の定例がロビーに出る');

select pg_temp.logout();
select public.run_room_schedules();
select is((select count(*)::int from public.notifications where kind = 'schedule'
           and room_id = '80000000-0000-0000-0000-000000000001'), 1, '30分前に参加者へお知らせ');

-- 開始時刻ちょうどにする → タイマーが始まる
update public.rooms set schedule_days = array[extract(isodow from now() at time zone 'Asia/Tokyo')::smallint],
  schedule_time = date_trunc('minute', now() at time zone 'Asia/Tokyo')::time,
  timer_started_at = now() - interval '2 hours'
where id = '80000000-0000-0000-0000-000000000001';
select public.run_room_schedules();
select is((select timer_started_at from public.rooms where id = '80000000-0000-0000-0000-000000000001'),
  date_trunc('minute', now()), '開始時刻になるとポモドーロが自動で始まる');

select * from finish();
rollback;
