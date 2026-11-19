-- 管理者が「フィードバックを送ってみませんか？」のお知らせを送る pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000024a1', 'fra@users.mokumoku.invalid', '{"username":"fra"}'),
  ('00000000-0000-0000-0000-0000000024b2', 'frb@users.mokumoku.invalid', '{"username":"frb"}'),
  ('00000000-0000-0000-0000-0000000024c3', 'frc@users.mokumoku.invalid', '{"username":"frc"}'),
  ('00000000-0000-0000-0000-0000000024d4', 'frd@users.mokumoku.invalid', '{"username":"frd"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000024a1';

-- b は最近勉強した人、c はしばらく来ていない人、d は利用停止中（最近勉強はしている）
insert into public.rooms (id, owner_id, name, visibility, is_persistent)
values ('24000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000024a1', 'お願いの部屋', 'public', true);
insert into public.study_sessions (room_id, user_id, task, started_at, ended_at, last_seen_at) values
  ('24000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000024b2', '数学', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', now() - interval '2 days'),
  ('24000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000024c3', '英語', now() - interval '20 days', now() - interval '20 days' + interval '1 hour', now() - interval '20 days'),
  ('24000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000024d4', '国語', now() - interval '1 day', now() - interval '1 day' + interval '1 hour', now() - interval '1 day');

update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000024d4';

create temp view my_requests as
  select user_id, detail from public.notifications
  where kind = 'feedback_request'
    and user_id in ('00000000-0000-0000-0000-0000000024a1', '00000000-0000-0000-0000-0000000024b2',
                    '00000000-0000-0000-0000-0000000024c3', '00000000-0000-0000-0000-0000000024d4');

-- 管理者でない人は送れない
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024b2","role":"authenticated"}', true);
select throws_ok($$ select public.admin_send_feedback_request('こんにちは', 'all') $$, 'P0001', 'admin_only', '管理者でない人は送れない');
select throws_ok($$ select public.admin_feedback_audience_count('all') $$, 'P0001', 'admin_only', '管理者でない人は人数も見られない');

-- 管理者が送る
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated"}', true);
select throws_ok($$ select public.admin_send_feedback_request('   ', 'all') $$, 'P0001', 'invalid_message', '空の文では送れない');
select throws_ok($$ select public.admin_send_feedback_request('こんにちは', 'everyone') $$, 'P0001', 'invalid_audience', '相手の選び方がおかしいと送れない');
select ok(public.admin_feedback_audience_count('active') < public.admin_feedback_audience_count('all'), '最近の人は、全員より少ない');
select lives_ok($$ select public.admin_send_feedback_request('フィードバックを送ってみませんか？', 'active') $$, '最近7日間に勉強した人に送れる');
reset role;

select is((select array_agg(user_id order by user_id) from my_requests), array['00000000-0000-0000-0000-0000000024b2']::uuid[],
  '最近勉強した人にだけ届く（来ていない人・利用停止中の人・送った本人にはとどかない）');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated"}', true);
select lives_ok($$ select public.admin_send_feedback_request('もう一度お願いします', 'all') $$, '全員に送れる');
reset role;
select is((select count(*)::int from my_requests where detail = 'もう一度お願いします'), 2, '全員に送ると、しばらく来ていない人にも届く（利用停止中と本人はのぞく）');

-- 受け取った人のお知らせの一覧に出る
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024c3","role":"authenticated"}', true);
select is((select detail from public.list_notifications() where kind = 'feedback_request' limit 1), 'もう一度お願いします', 'お知らせの一覧に文が出る');

select * from finish();
rollback;
