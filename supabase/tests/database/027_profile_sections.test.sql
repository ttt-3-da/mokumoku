-- プロフィールの項目ごとの見せる・見せない pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000027a1', 'psa@users.mokumoku.invalid', '{"username":"psa"}'),
  ('00000000-0000-0000-0000-0000000027b2', 'psb@users.mokumoku.invalid', '{"username":"psb"}');
insert into public.user_badges (user_id, badge_id) values ('00000000-0000-0000-0000-0000000027a1', 'first_session')
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000027a1","role":"authenticated"}', true);
select throws_ok($$ select public.set_profile_section_hidden('secret', true) $$, 'P0001', 'invalid_section', 'ない項目は切りかえられない');
select is(public.set_profile_section_hidden('grass', true), array['grass'], '草カレンダーを自分だけにできる');
select is(public.set_profile_section_hidden('tags', true), array['grass', 'tags'], 'タグ別の割合も自分だけにできる');
select is(public.set_profile_section_hidden('badges', true), array['badges', 'grass', 'tags'], 'バッジも自分だけにできる');
select ok(public.get_profile_stats('psa') ? 'calendar', '本人には草カレンダーが見える');

-- ほかの人には隠した項目が来ない
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000027b2","role":"authenticated"}', true);
select ok(not (public.get_profile_stats('psa') ? 'calendar') and not (public.get_profile_stats('psa') ? 'tags'), 'ほかの人には草カレンダーとタグ別の割合が来ない');
select ok(public.get_profile_stats('psa') ? 'week', '隠していない項目は見える');
select is((select count(*)::int from public.list_user_badges('psa')), 0, 'ほかの人には隠したバッジが来ない');

-- 戻すと見える
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000027a1","role":"authenticated"}', true);
select public.set_profile_section_hidden('grass', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000027b2","role":"authenticated"}', true);
select ok(public.get_profile_stats('psa') ? 'calendar', 'みんなに公開に戻すと、ほかの人にも見える');

select * from finish();
rollback;
