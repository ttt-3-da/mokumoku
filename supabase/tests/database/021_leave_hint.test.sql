-- タブを閉じたら30秒で退室になる pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000021a1', 'lva@users.mokumoku.invalid', '{"username":"lva"}'),
  ('00000000-0000-0000-0000-0000000021b2', 'lvb@users.mokumoku.invalid', '{"username":"lvb"}'),
  ('00000000-0000-0000-0000-0000000021c3', 'lvc@users.mokumoku.invalid', '{"username":"lvc"}');

insert into public.rooms (id, owner_id, name, visibility, is_persistent)
values ('21000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000021a1', 'ふつう', 'public', true);

insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at)
select '21000000-0000-0000-0000-000000000001', u, '数学', now() - interval '20 minutes', now() - interval '40 seconds', now() - interval '40 seconds'
from unnest(array['00000000-0000-0000-0000-0000000021a1', '00000000-0000-0000-0000-0000000021b2', '00000000-0000-0000-0000-0000000021c3']::uuid[]) u;

-- a：自分でタブを閉じた知らせを送る
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select lives_ok($$ select public.mark_leaving() $$, '自分のセッションに「出ていった」を付けられる');
-- c：知らせのあと再読み込みして、ハートビートが来た
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021c3","role":"authenticated"}', true);
select public.mark_leaving();
select lives_ok($$ select public.heartbeat(null, 0) $$, 'ハートビートは送れる');
select is((select leaving_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000021c3'), null,
  'ハートビートが来ると「出ていった」が取り消される');
reset role;

-- a は40秒前に閉じたことにする
update public.study_sessions set leaving_at = now() - interval '40 seconds'
where user_id = '00000000-0000-0000-0000-0000000021a1';

select public.cleanup_stale_sessions();
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000021a1'),
  now() - interval '40 seconds', 'タブを閉じて30秒たつと、閉じた時刻で退室になる');
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000021b2'),
  null, '知らせのない人は、これまでどおり3分たつまで退室にならない');
select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000021c3'),
  null, '再読み込みした人は退室にならない');

select * from finish();
rollback;
