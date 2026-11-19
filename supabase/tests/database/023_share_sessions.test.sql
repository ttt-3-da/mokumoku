-- 勉強の記録のシェアの pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000023a1', 'sha@users.mokumoku.invalid', '{"username":"sha","display_name":"シェアもち"}'),
  ('00000000-0000-0000-0000-0000000023b2', 'shb@users.mokumoku.invalid', '{"username":"shb"}');

insert into public.rooms (id, owner_id, name, visibility, is_persistent)
values ('23000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000023a1', 'シェアの部屋', 'public', true);

insert into public.study_sessions (id, room_id, user_id, task, started_at, ended_at, last_seen_at, pomodoros) values
  ('23000000-0000-0000-0000-0000000000b1', '23000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000023a1', 'ひみつの課題',
   now() - interval '90 minutes', now() - interval '15 minutes', now() - interval '15 minutes', 3),
  ('23000000-0000-0000-0000-0000000000b2', '23000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000023a1', '短い',
   now() - interval '50 seconds', now() - interval '10 seconds', now() - interval '10 seconds', 0);

-- ログインしていない人：シェアする前は見えない
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.get_shared_session('23000000-0000-0000-0000-0000000000b1'), null, 'シェアする前は、ログインしていない人には見えない');
reset role;

-- b：ほかの人の記録はシェアできない
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023b2","role":"authenticated"}', true);
select throws_ok($$ select public.share_session('23000000-0000-0000-0000-0000000000b1') $$, 'P0001', 'session_not_found', 'ほかの人の記録はシェアできない');

-- a：シェアする
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
select throws_ok($$ select public.share_session('23000000-0000-0000-0000-0000000000b2') $$, 'P0001', 'too_short', '1分未満の記録はシェアできない');
select lives_ok($$ select public.share_session('23000000-0000-0000-0000-0000000000b1') $$, '自分の記録をシェアできる');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((public.get_shared_session('23000000-0000-0000-0000-0000000000b1') ->> 'minutes')::int, 75, 'シェアすると、勉強した時間が見える');
select is(public.get_shared_session('23000000-0000-0000-0000-0000000000b1') ->> 'display_name', 'シェアもち', '表示名が見える');
select is(public.get_shared_session('23000000-0000-0000-0000-0000000000b1') ? 'task', false, 'やったことは出さない');
reset role;

-- a：シェアをやめる
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
select lives_ok($$ select public.unshare_session('23000000-0000-0000-0000-0000000000b1') $$, 'シェアをやめられる');
reset role;
set local role anon;
select is(public.get_shared_session('23000000-0000-0000-0000-0000000000b1'), null, 'やめたあとは見えない');

select * from finish();
rollback;
