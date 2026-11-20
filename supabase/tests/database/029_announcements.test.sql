-- 運営からのお知らせ pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000029a1', 'ana@users.mokumoku.invalid', '{"username":"ana"}'),
  ('00000000-0000-0000-0000-0000000029b2', 'anb@users.mokumoku.invalid', '{"username":"anb"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000029a1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000029b2","role":"authenticated"}', true);
select throws_ok($$ select public.admin_send_announcement('直しました', 'all') $$, 'P0001', 'admin_only', '管理者でない人は送れない');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000029a1","role":"authenticated"}', true);
select throws_ok($$ select public.admin_send_announcement(repeat('あ', 301), 'all') $$, 'P0001', 'invalid_announcement', '300文字をこえると送れない');
select throws_ok($$ select public.admin_send_announcement('直しました', 'not_yet') $$, 'P0001', 'invalid_audience', 'お知らせでは「まだ受け取っていない人」は選べない');
select ok(public.admin_send_announcement('直しました', 'pick', array['00000000-0000-0000-0000-0000000029b2']::uuid[]) = 1, '選んだ人に送れる');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000029b2","role":"authenticated"}', true);
select is((select detail from public.list_notifications() where kind = 'announcement' limit 1), '直しました', '受け取った人のお知らせに出る');

select * from finish();
rollback;
