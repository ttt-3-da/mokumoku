-- =========================================================
-- コインとショップ（1回目：しくみ・色30種・テーマの有料化）
-- - コイン：勉強10分で1枚、ポモドーロ完了で2枚、連続3・7・30日で10・30・100枚、登録で30枚
-- - 部屋の🍅：その部屋でのみんなの勉強時間25分で1個。オーナー・モデレーターがテーマを買える
-- - 計算と買い物はすべてサーバー側で行う（クライアントからは直接書き込めない）
-- 中身は docs/shop-catalog.md を参照
-- =========================================================

-- ---------------------------------------------------------
-- ショップの品物
-- ---------------------------------------------------------
create table public.shop_items (
  item_id     text primary key,              -- 'color:kinako' のように「種類:ID」
  kind        text not null check (kind in ('color', 'eyes', 'mouth', 'cheeks', 'head', 'neck', 'desk', 'theme')),
  price       int  not null check (price > 0),
  currency    text not null check (currency in ('coin', 'tomato')),
  sort_order  int  not null default 0,
  released_at timestamptz not null default now()
);

alter table public.shop_items enable row level security;
create policy "shop_items: anyone signed in can read" on public.shop_items for select to authenticated using (true);
revoke all on public.shop_items from anon, authenticated;
grant select on public.shop_items to authenticated;

-- 今ある有料の色（きなこ・ごま・ラムネ・ゆず・むらさきいも）は少し前に出たことにする
insert into public.shop_items (item_id, kind, price, currency, sort_order, released_at) values
  ('color:kinako',      'color', 15, 'coin', 100, now() - interval '1 day'),
  ('color:goma',        'color', 15, 'coin', 101, now() - interval '1 day'),
  ('color:ramune',      'color', 15, 'coin', 102, now() - interval '1 day'),
  ('color:yuzu',        'color', 15, 'coin', 103, now() - interval '1 day'),
  ('color:murasakiimo', 'color', 15, 'coin', 104, now() - interval '1 day'),
  ('color:milk',           'color',   5, 'coin', 1, now()),
  ('color:zunda',          'color',  10, 'coin', 2, now()),
  ('color:kuri',           'color',  10, 'coin', 3, now()),
  ('color:mikan',          'color',  10, 'coin', 4, now()),
  ('color:houjicha',       'color',  10, 'coin', 5, now()),
  ('color:momo',           'color',  10, 'coin', 6, now()),
  ('color:lemon',          'color',  10, 'coin', 7, now()),
  ('color:anko',           'color',  15, 'coin', 8, now()),
  ('color:soda',           'color',  15, 'coin', 9, now()),
  ('color:budou',          'color',  15, 'coin', 10, now()),
  ('color:matcha',         'color',  15, 'coin', 11, now()),
  ('color:ichigo',         'color',  15, 'coin', 12, now()),
  ('color:choco',          'color',  20, 'coin', 13, now()),
  ('color:mint',           'color',  20, 'coin', 14, now()),
  ('color:caramel',        'color',  20, 'coin', 15, now()),
  ('color:blueberry',      'color',  20, 'coin', 16, now()),
  ('color:hiyoko',         'color',  20, 'coin', 17, now()),
  ('color:warabi',         'color',  20, 'coin', 18, now()),
  ('color:kuromitsu',      'color',  25, 'coin', 19, now()),
  ('color:suika',          'color',  25, 'coin', 20, now()),
  ('color:yozora',         'color',  25, 'coin', 21, now()),
  ('color:yuki',           'color',  25, 'coin', 22, now()),
  ('color:ichigodaifuku',  'color',  50, 'coin', 23, now()),
  ('color:sanshokudango',  'color',  60, 'coin', 24, now()),
  ('color:creamsoda',      'color',  50, 'coin', 25, now()),
  ('color:purin',          'color',  60, 'coin', 26, now()),
  ('color:yuuyake',        'color',  75, 'coin', 27, now()),
  ('color:rainbow',        'color', 150, 'coin', 28, now()),
  ('color:aurora',         'color', 150, 'coin', 29, now()),
  ('color:kiniro',         'color', 150, 'coin', 30, now()),
  ('theme:washitsu',       'theme',  20, 'tomato', 1, now()),
  ('theme:space',          'theme',  50, 'tomato', 2, now());

-- 体の色の選択肢を広げる（ID は src/lib/avatar.ts の COLORS と一致させる）
alter table public.avatars drop constraint avatars_color_check;
alter table public.avatars add constraint avatars_color_check check (color in (
  'shiro', 'sakura', 'yomogi', 'kinako', 'goma', 'ramune', 'yuzu', 'murasakiimo',
  'milk', 'zunda', 'kuri', 'mikan', 'houjicha', 'momo', 'lemon', 'anko', 'soda', 'budou', 'matcha', 'ichigo',
  'choco', 'mint', 'caramel', 'blueberry', 'hiyoko', 'warabi', 'kuromitsu', 'suika', 'yozora', 'yuki',
  'ichigodaifuku', 'sanshokudango', 'creamsoda', 'purin', 'yuuyake', 'rainbow', 'aurora', 'kiniro'));

-- 無料ではなくなった色を使っている人は白もちに戻す（相談のうえ「取り上げる」と決めた）
update public.avatars set color = 'shiro' where color not in ('shiro', 'sakura', 'yomogi');

-- ---------------------------------------------------------
-- 買ったもの（個人）
-- ---------------------------------------------------------
create table public.owned_items (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     text not null references public.shop_items (item_id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.owned_items enable row level security;
create policy "owned_items: read own" on public.owned_items for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.owned_items from anon, authenticated;
grant select on public.owned_items to authenticated;

-- ---------------------------------------------------------
-- コインの出入り。残高はこの合計（残高の列を持たないので、ずれない）
-- ---------------------------------------------------------
create table public.coin_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     int  not null check (amount <> 0),
  reason     text not null check (reason in ('signup', 'study', 'pomodoro', 'streak', 'purchase')),
  detail     text,                                   -- 連続日数 'streak:7'、買ったもの 'color:mint' など
  session_id uuid references public.study_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index coin_transactions_user_idx on public.coin_transactions (user_id, created_at desc);
create index coin_transactions_session_idx on public.coin_transactions (session_id);

alter table public.coin_transactions enable row level security;
create policy "coin_transactions: read own" on public.coin_transactions for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.coin_transactions from anon, authenticated;
grant select on public.coin_transactions to authenticated;

create or replace function public.coin_balance(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int from public.coin_transactions where user_id = p_user_id;
$$;

revoke execute on function public.coin_balance(uuid) from public, anon, authenticated;

-- 登録ボーナス（これから登録する人と、今いる人の両方）
create or replace function public.handle_new_profile_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.coin_transactions (user_id, amount, reason) values (new.id, 30, 'signup');
  return new;
end;
$$;

revoke execute on function public.handle_new_profile_coins() from public, anon, authenticated;

create trigger on_profile_created_coins
  after insert on public.profiles
  for each row execute function public.handle_new_profile_coins();

insert into public.coin_transactions (user_id, amount, reason)
select id, 30, 'signup' from public.profiles;

-- ---------------------------------------------------------
-- 勉強でコインをもらう（セッションを閉じるたびにサーバー側で計算）
-- ---------------------------------------------------------
create or replace function public.award_coins_internal(p_user_id uuid, p_session_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
  v_study   int;
  v_pomo    int;
  v_streak  int;
  v_bonus   int;
  v_total   int := 0;
begin
  select * into v_session from public.study_sessions where id = p_session_id and ended_at is not null;
  if not found then
    return 0;
  end if;

  v_study := public.session_minutes(v_session.started_at, v_session.ended_at) / 10;
  if v_study > 0 then
    insert into public.coin_transactions (user_id, amount, reason, session_id)
    values (p_user_id, v_study, 'study', p_session_id);
    v_total := v_total + v_study;
  end if;

  v_pomo := v_session.pomodoros * 2;
  if v_pomo > 0 then
    insert into public.coin_transactions (user_id, amount, reason, session_id)
    values (p_user_id, v_pomo, 'pomodoro', p_session_id);
    v_total := v_total + v_pomo;
  end if;

  -- 連続日数のボーナス：その日数に届いたとき1回だけ（同じ連続の中で二重にもらわない）
  v_streak := public.current_streak(p_user_id);
  v_bonus := case v_streak when 3 then 10 when 7 then 30 when 30 then 100 else 0 end;
  if v_bonus > 0 and not exists (
    select 1 from public.coin_transactions
    where user_id = p_user_id and reason = 'streak' and detail = 'streak:' || v_streak
      and created_at > now() - make_interval(days => v_streak)
  ) then
    insert into public.coin_transactions (user_id, amount, reason, detail, session_id)
    values (p_user_id, v_bonus, 'streak', 'streak:' || v_streak, p_session_id);
    v_total := v_total + v_bonus;
  end if;

  return v_total;
end;
$$;

revoke execute on function public.award_coins_internal(uuid, uuid) from public, anon, authenticated;

-- セッションを閉じる処理にコインの計算を足す（中身は前のマイグレーションと同じ＋1行）
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.close_session_internal(uuid, timestamp with time zone)'::regprocedure) into v_src;
  v_src := replace(v_src,
    '  perform public.evaluate_unlocks_internal(v_session.user_id, v_session.id);',
    '  perform public.evaluate_unlocks_internal(v_session.user_id, v_session.id);
  perform public.award_coins_internal(v_session.user_id, v_session.id);');
  if position('award_coins_internal' in v_src) = 0 then
    raise exception 'close_session_internal の書き換えに失敗しました';
  end if;
  execute v_src;
end;
$$;

-- ---------------------------------------------------------
-- ショップ：一覧・買う・財布
-- ---------------------------------------------------------
create or replace function public.my_wallet()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'coins', public.coin_balance(auth.uid()),
    'owned', coalesce((select jsonb_agg(item_id) from public.owned_items where user_id = auth.uid()), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;

create or replace function public.buy_item(p_item_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.shop_items;
  v_bal  int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_item from public.shop_items where item_id = p_item_id and currency = 'coin';
  if not found then
    raise exception 'item_not_found';
  end if;

  -- 同じ人が同時に買っても残高がマイナスにならないよう、その人の操作を1つずつにする
  perform public.lock_user(v_uid);

  if exists (select 1 from public.owned_items where user_id = v_uid and item_id = p_item_id) then
    raise exception 'already_owned';
  end if;
  v_bal := public.coin_balance(v_uid);
  if v_bal < v_item.price then
    raise exception 'not_enough_coins';
  end if;

  insert into public.owned_items (user_id, item_id) values (v_uid, p_item_id);
  insert into public.coin_transactions (user_id, amount, reason, detail)
  values (v_uid, -v_item.price, 'purchase', p_item_id);
  return v_bal - v_item.price;
end;
$$;

create or replace function public.list_coin_history(p_limit int default 50)
returns table (amount int, reason text, detail text, created_at timestamptz, room_name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.amount, t.reason, t.detail, t.created_at,
         case when r.deleted_at is null then r.name else '削除された部屋' end
  from public.coin_transactions t
  left join public.study_sessions s on s.id = t.session_id
  left join public.rooms r on r.id = s.room_id
  where t.user_id = auth.uid()
  order by t.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- 着せかえの保存：解放アイテムに加えて、ショップの品物は買っていないと使えない
create or replace function public.save_avatar(
  p_color text, p_eyes text, p_mouth text, p_cheeks text,
  p_head text, p_desk text, p_hachimaki text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  foreach v_item in array array[
    'color:' || p_color, 'eyes:' || p_eyes, 'mouth:' || p_mouth, 'cheeks:' || p_cheeks,
    'head:' || p_head, 'desk:' || p_desk, 'hachimaki:' || p_hachimaki] loop
    if v_item in ('head:leaf', 'head:crown', 'hachimaki:indigo',
                  'desk:mug', 'desk:lamp', 'desk:plant', 'desk:pet')
       and not exists (select 1 from public.unlocks where user_id = v_uid and item_id = v_item) then
      raise exception 'item_locked';
    end if;
    if exists (select 1 from public.shop_items where item_id = v_item)
       and not exists (select 1 from public.owned_items where user_id = v_uid and item_id = v_item) then
      raise exception 'item_locked';
    end if;
  end loop;

  begin
    insert into public.avatars as a (user_id, color, eyes, mouth, cheeks, head, desk, hachimaki, updated_at)
    values (v_uid, p_color, p_eyes, p_mouth, p_cheeks, p_head, p_desk, p_hachimaki, now())
    on conflict (user_id) do update
      set color = excluded.color, eyes = excluded.eyes, mouth = excluded.mouth,
          cheeks = excluded.cheeks, head = excluded.head, desk = excluded.desk,
          hachimaki = excluded.hachimaki, updated_at = now();
  exception
    when check_violation or not_null_violation then
      raise exception 'invalid_avatar';
  end;

  return public.avatar_json(v_uid);
end;
$$;

-- ---------------------------------------------------------
-- 部屋の🍅とテーマ
-- ---------------------------------------------------------
create table public.room_owned_themes (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  theme      text not null,
  price_paid int  not null default 0 check (price_paid >= 0),
  bought_by  uuid references public.profiles (id) on delete set null,
  bought_at  timestamptz not null default now(),
  primary key (room_id, theme)
);

alter table public.room_owned_themes enable row level security;
create policy "room_owned_themes: viewable rooms" on public.room_owned_themes for select to authenticated
  using (public.can_view_room(room_id));
revoke all on public.room_owned_themes from anon, authenticated;
grant select on public.room_owned_themes to authenticated;

-- 有料になったテーマをすでに使っている部屋には、そのテーマを持っていることにする（見た目が急に変わらないように）
insert into public.room_owned_themes (room_id, theme)
select id, theme from public.rooms where theme in ('washitsu', 'space')
on conflict do nothing;

-- 部屋の🍅の残り＝（その部屋で閉じたセッションの合計分 ÷ 25）− 使った分
create or replace function public.room_tomatoes(p_room_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (coalesce((select sum(public.session_minutes(started_at, ended_at))
                    from public.study_sessions
                    where room_id = p_room_id and ended_at is not null), 0) / 25)::int
       - coalesce((select sum(price_paid) from public.room_owned_themes where room_id = p_room_id), 0)::int;
$$;

revoke execute on function public.room_tomatoes(uuid) from public, anon, authenticated;

-- テーマは「無料」か「その部屋が持っている」ものだけ設定できる
create or replace function public.theme_available(p_room_id uuid, p_theme text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_theme in ('library', 'cafe')
      or exists (select 1 from public.room_owned_themes where room_id = p_room_id and theme = p_theme);
$$;

revoke execute on function public.theme_available(uuid, text) from public, anon, authenticated;

-- だれが部屋を作っても動くよう、サーバーの権限で確かめる（security definer）
create or replace function public.check_room_theme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.theme_available(new.id, new.theme) then
    raise exception 'theme_locked';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_room_theme() from public, anon, authenticated;

create trigger rooms_check_theme
  before insert or update of theme on public.rooms
  for each row execute function public.check_room_theme();

-- 部屋のテーマの情報（入室中の人が見る）
create or replace function public.room_theme_shop(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_view_room(p_room_id) then
    return null;
  end if;
  return jsonb_build_object(
    'tomatoes', public.room_tomatoes(p_room_id),
    'owned', coalesce((select jsonb_agg(theme) from public.room_owned_themes where room_id = p_room_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('theme', substr(item_id, 7), 'price', price) order by sort_order)
                       from public.shop_items where kind = 'theme'), '[]'::jsonb)
  );
end;
$$;

-- テーマを🍅で買う（オーナー・モデレーター）
create or replace function public.buy_room_theme(p_room_id uuid, p_theme text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price int;
  v_left  int;
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  select price into v_price from public.shop_items where item_id = 'theme:' || p_theme and currency = 'tomato';
  if v_price is null then
    raise exception 'item_not_found';
  end if;

  -- 同じ部屋で同時に買っても🍅がマイナスにならないよう、部屋の行をロックする
  perform 1 from public.rooms where id = p_room_id for update;

  if exists (select 1 from public.room_owned_themes where room_id = p_room_id and theme = p_theme) then
    raise exception 'already_owned';
  end if;
  v_left := public.room_tomatoes(p_room_id);
  if v_left < v_price then
    raise exception 'not_enough_tomatoes';
  end if;

  insert into public.room_owned_themes (room_id, theme, price_paid, bought_by)
  values (p_room_id, p_theme, v_price, auth.uid());
  return v_left - v_price;
end;
$$;

-- テーマを変える（オーナー・モデレーター）。持っていないテーマはトリガーで止まる
create or replace function public.set_room_theme(p_room_id uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  update public.rooms set theme = p_theme where id = p_room_id;
end;
$$;

revoke execute on function public.my_wallet(), public.buy_item(text), public.list_coin_history(int),
  public.room_theme_shop(uuid), public.buy_room_theme(uuid, text), public.set_room_theme(uuid, text)
  from public, anon;
grant execute on function public.my_wallet(), public.buy_item(text), public.list_coin_history(int),
  public.room_theme_shop(uuid), public.buy_room_theme(uuid, text), public.set_room_theme(uuid, text)
  to authenticated;
