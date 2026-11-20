-- ほかのタブを見ている間（タブが見えていない間）の扱い pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000028a1', 'awa@users.mokumoku.invalid', '{"username":"awa"}'),
  ('00000000-0000-0000-0000-0000000028b2', 'awb@users.mokumoku.invalid', '{"username":"awb"}'),
  ('00000000-0000-0000-0000-0000000028c3', 'awc@users.mokumoku.invalid', '{"username":"awc"}');
insert into public.rooms (id, owner_id, name, timer_mode, is_persistent)
values ('28000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000028a1', '離席の部屋', 'free', true);

-- a: 見えなくなって5分、ハートビートは止まっている → 落とさない
-- b: 見えなくなって40分 → 退室。記録は見えなくなって15分のところまで
-- c: 見えていて、ハートビートが5分止まっている → これまでどおり退室
insert into public.study_sessions (room_id, user_id, task, started_at, last_seen_at, last_active_at, hidden_since) values
  ('28000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000028a1', '数学', now() - interval '30 minutes', now() - interval '5 minutes', now() - interval '5 minutes', now() - interval '5 minutes'),
  ('28000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000028b2', '英語', now() - interval '60 minutes', now() - interval '40 minutes', now() - interval '40 minutes', now() - interval '40 minutes'),
  ('28000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000028c3', '国語', now() - interval '30 minutes', now() - interval '5 minutes', now() - interval '5 minutes', null);

select public.cleanup_stale_sessions();

select is((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028a1'), null,
  '見えなくなって5分なら、ハートビートが止まっていても落とさない');
select is((select end_reason from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028b2'), 'away',
  '見えなくなって35分をこえたら退室（離席）');
select ok((select abs(extract(epoch from ended_at - (hidden_since + interval '15 minutes'))) < 1
           from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028b2'),
  '離席で退室したときの記録は、見えなくなって15分のところまで');
select isnt((select ended_at from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028c3'), null,
  '見えているのにハートビートが止まった人は、これまでどおり退室');
select ok((select bool_and(auto_closed) from public.study_sessions where user_id in ('00000000-0000-0000-0000-0000000028b2', '00000000-0000-0000-0000-0000000028c3')),
  '自動で退室になった記録には印が付く');

-- 自動で退室になった人は、戻ってきたら入り直せる
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000028c3","role":"authenticated"}', true);
select is((public.rejoin_after_drop((select id from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028c3' and ended_at is not null)))->>'status',
  'entered', '自動で退室になったら、同じ部屋に入り直せる');
select is((select count(*)::int from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028c3' and ended_at is null), 1,
  '入り直すと、新しい記録が始まる');
-- 自分で退室したときは入り直さない
select public.leave_room();
select throws_ok(
  format($$ select public.rejoin_after_drop(%L) $$, (select id from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028c3' order by started_at desc limit 1)),
  'P0001', 'cannot_rejoin', '自分で退室したときは、自動で入り直さない');

-- a: タブが見えなくなったら印を付け、ハートビートで外す
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000028a1","role":"authenticated"}', true);
select public.heartbeat(null, 0, false);
select is((select hidden_since from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028a1' and ended_at is null), null,
  'タブに戻ってハートビートを送ると、見えていない印が外れる');
select public.mark_hidden();
select isnt((select hidden_since from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028a1' and ended_at is null), null,
  'タブが見えなくなると印が付く');
select is((select count(*)::int from public.get_room_hidden_members('28000000-0000-0000-0000-0000000000a1')), 1,
  '同じ部屋の人から、見えていない人がわかる');
reset role;

-- 15分をこえて離れてから戻ったら、記録を区切って続きを始める
update public.study_sessions set hidden_since = now() - interval '20 minutes'
where user_id = '00000000-0000-0000-0000-0000000028a1' and ended_at is null;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000028a1","role":"authenticated"}', true);
select is((public.heartbeat(null, 0, false))->>'split', 'true', '15分をこえて離れてから戻ると、記録が区切られる');
reset role;
select ok((select abs(extract(epoch from ended_at - (hidden_since + interval '15 minutes'))) < 1
           from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028a1' and end_reason = 'away'),
  '区切られた記録は、見えなくなって15分のところまで（それ以降は勉強時間に入れない）');
select is((select count(*)::int from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000028a1' and ended_at is null), 1,
  '同じ部屋で続きが始まっている');

select * from finish();
rollback;
