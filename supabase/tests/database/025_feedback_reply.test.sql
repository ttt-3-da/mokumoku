-- 管理者がフィードバックに返信する pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000025a1', 'fba@users.mokumoku.invalid', '{"username":"fba"}'),
  ('00000000-0000-0000-0000-0000000025b2', 'fbb@users.mokumoku.invalid', '{"username":"fbb"}'),
  ('00000000-0000-0000-0000-0000000025c3', 'fbc@users.mokumoku.invalid', '{"username":"fbc"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000025a1';
insert into public.feedback (id, user_id, kind, body) values
  ('25000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000025b2', 'request', 'ダークモードがほしい'),
  ('25000000-0000-0000-0000-0000000000f2', null, 'bug', '退会した人の意見');

-- 管理者でない人は返信できない
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000025b2","role":"authenticated"}', true);
select throws_ok($$ select public.admin_reply_feedback('25000000-0000-0000-0000-0000000000f1', 'はい') $$, 'P0001', 'admin_only', '管理者でない人は返信できない');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000025a1","role":"authenticated"}', true);
select throws_ok($$ select public.admin_reply_feedback('25000000-0000-0000-0000-0000000000f1', '  ') $$, 'P0001', 'invalid_reply', '空の返信は送れない');
select throws_ok($$ select public.admin_reply_feedback('25000000-0000-0000-0000-0000000000f2', 'はい') $$, 'P0001', 'user_gone', '退会した人には返信できない');
select throws_ok($$ select public.admin_reply_feedback(gen_random_uuid(), 'はい') $$, 'P0001', 'feedback_not_found', 'ないフィードバックには返信できない');
select lives_ok($$ select public.admin_reply_feedback('25000000-0000-0000-0000-0000000000f1', ' 検討します！ ') $$, '管理者は返信できる');
select is((select reply from public.admin_list_feedback() where id = '25000000-0000-0000-0000-0000000000f1'), '検討します！', '管理者の一覧に返信が出る');

-- 送った人：お知らせに届き、意見箱で見られる
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000025b2","role":"authenticated"}', true);
select is((select detail from public.list_notifications() where kind = 'feedback_reply' limit 1), '検討します！', '送った人のお知らせに返信が届く');
select is((select reply from public.my_feedback() limit 1), '検討します！', '意見箱で自分の意見の返信が見られる');

-- ほかの人には見えない
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000025c3","role":"authenticated"}', true);
select is((select count(*)::int from public.my_feedback()), 0, 'ほかの人の意見と返信は見えない');

select * from finish();
rollback;
