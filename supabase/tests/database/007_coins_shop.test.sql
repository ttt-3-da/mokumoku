-- コイン・ショップ・部屋の🍅 の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- バッジのコインとお知らせは 010 で確かめる。ここでは数がずれないよう止めておく
update public.badge_defs set coins = 0;
alter table public.follows disable trigger follows_badge;
alter table public.rooms disable trigger rooms_badge;

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005a1', 'coin_amy@users.mokumoku.invalid', '{"username":"coin_amy"}'),
  ('00000000-0000-0000-0000-0000000005b2', 'coin_ben@users.mokumoku.invalid', '{"username":"coin_ben"}');

insert into public.rooms (id, owner_id, name, timer_mode, focus_minutes, break_minutes) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000005a1', 'コインの部屋', 'pomodoro', 25, 5);

-- ---------------------------------------------------------------- 登録ボーナス・財布
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
select is(((public.my_wallet()) ->> 'coins')::int, 30, '登録すると30コイン持っている');
select throws_ok($$ insert into public.coin_transactions (user_id, amount, reason)
                    values ('00000000-0000-0000-0000-0000000005a1', 9999, 'study') $$,
  '42501', null, 'コインを自分で増やせない');
select throws_ok($$ insert into public.owned_items (user_id, item_id)
                    values ('00000000-0000-0000-0000-0000000005a1', 'color:rainbow') $$,
  '42501', null, '品物を自分で手に入れられない');

-- ---------------------------------------------------------------- 買う
select throws_ok($$ select public.buy_item('color:rainbow') $$, 'P0001', 'not_enough_coins', 'コインが足りないと買えない');
select throws_ok($$ select public.buy_item('color:nijiiro') $$, 'P0001', 'item_not_found', 'ない品物は買えない');
select throws_ok($$ select public.buy_item('theme:space') $$, 'P0001', 'item_not_found', 'テーマはコインでは買えない');
select is(public.buy_item('color:mint'), 10, 'ミント（20コイン）を買うと残りは10コイン');
select throws_ok($$ select public.buy_item('color:mint') $$, 'P0001', 'already_owned', '同じものは2回買えない');
select is(((public.my_wallet()) -> 'owned') ? 'color:mint', true, '買ったものが財布に入る');

-- ---------------------------------------------------------------- 着せかえ
select throws_ok($$ select public.save_avatar('kinako', 'dot', 'omega', 'pink', 'none', 'none', 'red') $$,
  'P0001', 'item_locked', '買っていない色は着られない');
select is((public.save_avatar('mint', 'dot', 'omega', 'pink', 'none', 'none', 'red')) ->> 'color', 'mint', '買った色は着られる');
select is((public.save_avatar('yomogi', 'dot', 'omega', 'pink', 'none', 'none', 'red')) ->> 'color', 'yomogi', '無料の色はいつでも着られる');

-- ---------------------------------------------------------------- 勉強でもらう
-- 2時間（ポモドーロ4回）勉強して退室したことにする
select public.enter_room('60000000-0000-0000-0000-000000000001', '英単語');
select pg_temp.logout();
update public.study_sessions set started_at = now() - interval '2 hours'
where user_id = '00000000-0000-0000-0000-0000000005a1' and ended_at is null;
update public.rooms set timer_started_at = now() - interval '2 hours' where id = '60000000-0000-0000-0000-000000000001';
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
select public.leave_room();
select is((select sum(amount)::int from public.coin_transactions
           where user_id = '00000000-0000-0000-0000-0000000005a1' and reason = 'study'), 12, '勉強120分で12コイン');
select is((select sum(amount)::int from public.coin_transactions
           where user_id = '00000000-0000-0000-0000-0000000005a1' and reason = 'pomodoro'), 8, 'ポモドーロ4回で8コイン');
select is(((public.my_wallet()) ->> 'coins')::int, 30, '残高は 10 + 12 + 8 = 30');
select is((select count(*)::int from public.list_coin_history()), 4, '履歴に 登録・購入・勉強・ポモドーロ が並ぶ');

-- ---------------------------------------------------------------- 部屋の🍅とテーマ
select is((public.room_theme_shop('60000000-0000-0000-0000-000000000001')) ->> 'tomatoes', '4', '勉強120分で部屋に🍅4個');
select throws_ok($$ select public.set_room_theme('60000000-0000-0000-0000-000000000001', 'space') $$,
  'P0001', 'theme_locked', '買っていないテーマにはできない');
select throws_ok($$ update public.rooms set theme = 'washitsu' where id = '60000000-0000-0000-0000-000000000001' $$,
  'P0001', 'theme_locked', '直接書きかえても、買っていないテーマにはできない');
select throws_ok($$ select public.buy_room_theme('60000000-0000-0000-0000-000000000001', 'washitsu') $$,
  'P0001', 'not_enough_tomatoes', '🍅が足りないと買えない');

select pg_temp.login('00000000-0000-0000-0000-0000000005b2');
select throws_ok($$ select public.buy_room_theme('60000000-0000-0000-0000-000000000001', 'washitsu') $$,
  'P0001', 'forbidden', 'オーナー・モデレーター以外はテーマを買えない');

-- 🍅を20個ためて買う（1日分の勉強がたまっていたことにする）
select pg_temp.logout();
insert into public.study_sessions (room_id, user_id, task, started_at, ended_at)
values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000005b2', '長文',
        now() - interval '9 hours', now() - interval '1 hour');
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
select is(public.buy_room_theme('60000000-0000-0000-0000-000000000001', 'washitsu'), 4, '和室（🍅20）を買うと🍅が減る（合計600分で🍅24 − 20 = 4）');
select lives_ok($$ select public.set_room_theme('60000000-0000-0000-0000-000000000001', 'washitsu') $$, '買ったテーマにできる');
select lives_ok($$ select public.set_room_theme('60000000-0000-0000-0000-000000000001', 'cafe') $$, '無料のテーマにはいつでもできる');

select * from finish();
rollback;
