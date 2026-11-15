-- =========================================================
-- もちの部屋（壁紙・家具）・フォルム（もちの形）・ロビーの部屋カードに出すもち
-- ID は src/lib/mochi-room.ts・src/lib/avatar.ts（FORMS）と一致させる
-- =========================================================

alter table public.shop_items drop constraint shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('color', 'eyes', 'mouth', 'cheeks', 'head', 'neck', 'desk', 'theme', 'stamp', 'emote',
                  'wallpaper', 'furniture', 'form'));

-- 無料のもの（壁紙：クリーム・さくら、家具：観葉植物・ラグ・スタンドライト、形：まる）は品物に入れない
insert into public.shop_items (item_id, kind, price, currency, sort_order) values
  ('wallpaper:mint',     'wallpaper', 15, 'coin', 400),
  ('wallpaper:sky',      'wallpaper', 15, 'coin', 401),
  ('wallpaper:stripe',   'wallpaper', 20, 'coin', 402),
  ('wallpaper:dots',     'wallpaper', 20, 'coin', 403),
  ('wallpaper:check',    'wallpaper', 25, 'coin', 404),
  ('wallpaper:wood',     'wallpaper', 25, 'coin', 405),
  ('wallpaper:washi',    'wallpaper', 30, 'coin', 406),
  ('wallpaper:night',    'wallpaper', 40, 'coin', 407),
  ('furniture:cushion',  'furniture', 20, 'coin', 500),
  ('furniture:clock',    'furniture', 20, 'coin', 501),
  ('furniture:window',   'furniture', 30, 'coin', 502),
  ('furniture:shelf',    'furniture', 30, 'coin', 503),
  ('furniture:sofa',     'furniture', 40, 'coin', 504),
  ('furniture:bed',      'furniture', 50, 'coin', 505),
  ('furniture:kotatsu',  'furniture', 60, 'coin', 506),
  ('form:square',        'form',      80, 'coin', 600),
  ('form:double',        'form',     100, 'coin', 601),
  ('form:triple',        'form',     150, 'coin', 602),
  ('form:king',          'form',     300, 'coin', 603);

-- ---------------------------------------------------------
-- フォルム（もちの形）
-- ---------------------------------------------------------
alter table public.avatars add column form text not null default 'round'
  check (form in ('round', 'square', 'double', 'triple', 'king'));

create or replace function public.avatar_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('color', a.color, 'eyes', a.eyes, 'mouth', a.mouth, 'cheeks', a.cheeks,
                               'head', a.head, 'neck', a.neck, 'desk', a.desk, 'hachimaki', a.hachimaki,
                               'form', a.form)
     from public.avatars a where a.user_id = p_user_id),
    '{}'::jsonb);
$$;

create or replace function public.set_avatar_form(p_form text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_form not in ('round', 'square', 'double', 'triple', 'king') then
    raise exception 'invalid_avatar';
  end if;
  if p_form <> 'round' and not exists (select 1 from public.owned_items where user_id = v_uid and item_id = 'form:' || p_form) then
    raise exception 'item_locked';
  end if;
  insert into public.avatars as a (user_id, form) values (v_uid, p_form)
  on conflict (user_id) do update set form = excluded.form, updated_at = now();
  return public.avatar_json(v_uid);
end;
$$;

revoke execute on function public.set_avatar_form(text) from public, anon;
grant execute on function public.set_avatar_form(text) to authenticated;

-- ---------------------------------------------------------
-- もちの部屋：壁紙と、置いた家具（位置は部屋の幅・高さに対する 0〜100）
-- ---------------------------------------------------------
create table public.mochi_rooms (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  wallpaper  text not null default 'cream',
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mochi_rooms enable row level security;
revoke all on public.mochi_rooms from anon, authenticated;

create or replace function public.save_mochi_room(p_wallpaper text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item jsonb;
  v_id   text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_wallpaper not in ('cream', 'sakura', 'mint', 'sky', 'stripe', 'dots', 'check', 'wood', 'washi', 'night') then
    raise exception 'invalid_mochi_room';
  end if;
  if p_wallpaper not in ('cream', 'sakura')
     and not exists (select 1 from public.owned_items where user_id = v_uid and item_id = 'wallpaper:' || p_wallpaper) then
    raise exception 'item_locked';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then
    raise exception 'invalid_mochi_room';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_id := v_item ->> 'id';
    if v_id is null or v_id not in ('plant', 'rug', 'lamp', 'cushion', 'clock', 'window', 'shelf', 'sofa', 'bed', 'kotatsu')
       or jsonb_typeof(v_item -> 'x') <> 'number' or jsonb_typeof(v_item -> 'y') <> 'number'
       or (v_item ->> 'x')::numeric not between 0 and 100 or (v_item ->> 'y')::numeric not between 0 and 100 then
      raise exception 'invalid_mochi_room';
    end if;
    if v_id not in ('plant', 'rug', 'lamp')
       and not exists (select 1 from public.owned_items where user_id = v_uid and item_id = 'furniture:' || v_id) then
      raise exception 'item_locked';
    end if;
  end loop;

  insert into public.mochi_rooms (user_id, wallpaper, items, updated_at)
  values (v_uid, p_wallpaper,
          (select coalesce(jsonb_agg(jsonb_build_object('id', e ->> 'id', 'x', round((e ->> 'x')::numeric, 1), 'y', round((e ->> 'y')::numeric, 1))), '[]'::jsonb)
           from jsonb_array_elements(p_items) e),
          now())
  on conflict (user_id) do update set wallpaper = excluded.wallpaper, items = excluded.items, updated_at = now();
end;
$$;

revoke execute on function public.save_mochi_room(text, jsonb) from public, anon;
grant execute on function public.save_mochi_room(text, jsonb) to authenticated;

-- 自分の部屋か、公開しているほかの人の部屋を見る
create or replace function public.get_mochi_room(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'is_me', p.id = auth.uid(),
    'wallpaper', coalesce(m.wallpaper, 'cream'),
    'items', coalesce(m.items, '[]'::jsonb),
    'avatar', public.avatar_json(p.id)
  )
  from public.profiles p
  left join public.mochi_rooms m on m.user_id = p.id
  where p.username = lower(btrim(p_username))
    and (p.is_public or p.id = auth.uid())
    and auth.uid() is not null;
$$;

revoke execute on function public.get_mochi_room(text) from public, anon;
grant execute on function public.get_mochi_room(text) to authenticated;

-- ---------------------------------------------------------
-- ロビーの部屋カード：いま中にいる人のもち（1部屋5人まで。見てよい部屋だけ）
-- ---------------------------------------------------------
create or replace function public.room_member_avatars(p_room_ids uuid[])
returns table (room_id uuid, avatars jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select s.room_id, jsonb_agg(public.avatar_json(s.user_id) order by s.started_at)
  from (
    select s.room_id, s.user_id, s.started_at,
           row_number() over (partition by s.room_id order by s.started_at) as n
    from public.study_sessions s
    where s.ended_at is null and s.room_id = any (p_room_ids[1:30])
  ) s
  where s.n <= 5 and public.can_view_room(s.room_id) and auth.uid() is not null
  group by s.room_id;
$$;

revoke execute on function public.room_member_avatars(uuid[]) from public, anon;
grant execute on function public.room_member_avatars(uuid[]) to authenticated;
