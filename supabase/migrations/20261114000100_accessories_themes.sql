-- =========================================================
-- コインとショップ（3回目・4回目）：アクセサリー30種と部屋のテーマ15種
-- - 頭の小物15種・首の小物5種（頭と同時に付けられる）・机の小物10種
-- - 部屋のテーマ15種（部屋にたまる🍅で買う）
-- 名前と値段は docs/shop-catalog.md、ID は src/lib/avatar.ts・src/lib/room-theme.ts と一致させる
-- =========================================================

-- ---------------------------------------------------------
-- もち：首の小物の枠を足し、頭・机の小物を増やす
-- ---------------------------------------------------------
alter table public.avatars add column neck text not null default 'none';
alter table public.avatars add constraint avatars_neck_check check (neck in (
  'none', 'yodare', 'choutie', 'muffler', 'scarf', 'pendant'));

alter table public.avatars drop constraint avatars_head_check;
alter table public.avatars add constraint avatars_head_check check (head in (
  'none', 'ribbon', 'leaf', 'crown',
  'ahoge', 'odango', 'bigribbon', 'nekomimi', 'usamimi', 'kumamimi', 'chonmage', 'beret',
  'knit', 'tsuno', 'mugiwara', 'hanakanmuri', 'headphones', 'mahou', 'tenshi'));

alter table public.avatars drop constraint avatars_desk_check;
alter table public.avatars add constraint avatars_desk_check check (desk in (
  'none', 'mug', 'lamp', 'plant', 'pet',
  'pencils', 'onigiri', 'books', 'sunadokei', 'mezamashi', 'saboten', 'cake', 'globe', 'kingyo', 'nekonui'));

insert into public.shop_items (item_id, kind, price, currency, sort_order) values
  ('head:ahoge',       'head', 15, 'coin', 1),
  ('head:odango',      'head', 25, 'coin', 2),
  ('head:bigribbon',   'head', 25, 'coin', 3),
  ('head:nekomimi',    'head', 40, 'coin', 4),
  ('head:usamimi',     'head', 40, 'coin', 5),
  ('head:kumamimi',    'head', 40, 'coin', 6),
  ('head:chonmage',    'head', 40, 'coin', 7),
  ('head:beret',       'head', 50, 'coin', 8),
  ('head:knit',        'head', 50, 'coin', 9),
  ('head:tsuno',       'head', 50, 'coin', 10),
  ('head:mugiwara',    'head', 60, 'coin', 11),
  ('head:hanakanmuri', 'head', 60, 'coin', 12),
  ('head:headphones',  'head', 75, 'coin', 13),
  ('head:mahou',       'head', 75, 'coin', 14),
  ('head:tenshi',      'head', 150, 'coin', 15),
  ('neck:yodare',      'neck', 15, 'coin', 1),
  ('neck:choutie',     'neck', 25, 'coin', 2),
  ('neck:muffler',     'neck', 40, 'coin', 3),
  ('neck:scarf',       'neck', 40, 'coin', 4),
  ('neck:pendant',     'neck', 50, 'coin', 5),
  ('desk:pencils',     'desk', 10, 'coin', 1),
  ('desk:onigiri',     'desk', 10, 'coin', 2),
  ('desk:books',       'desk', 15, 'coin', 3),
  ('desk:sunadokei',   'desk', 25, 'coin', 4),
  ('desk:mezamashi',   'desk', 25, 'coin', 5),
  ('desk:saboten',     'desk', 25, 'coin', 6),
  ('desk:cake',        'desk', 40, 'coin', 7),
  ('desk:globe',       'desk', 50, 'coin', 8),
  ('desk:kingyo',      'desk', 75, 'coin', 9),
  ('desk:nekonui',     'desk', 75, 'coin', 10);

-- アバターの JSON に首の小物を足す
create or replace function public.avatar_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('color', a.color, 'eyes', a.eyes, 'mouth', a.mouth, 'cheeks', a.cheeks,
                               'head', a.head, 'neck', a.neck, 'desk', a.desk, 'hachimaki', a.hachimaki)
     from public.avatars a where a.user_id = p_user_id),
    '{}'::jsonb);
$$;

-- 着せかえの保存：首の小物を受け取れるように作り直す（引数が変わるので古いものは消す）
drop function public.save_avatar(text, text, text, text, text, text, text);

create function public.save_avatar(
  p_color text, p_eyes text, p_mouth text, p_cheeks text,
  p_head text, p_desk text, p_hachimaki text, p_neck text default 'none'
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
    'head:' || p_head, 'neck:' || p_neck, 'desk:' || p_desk, 'hachimaki:' || p_hachimaki] loop
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
    insert into public.avatars as a (user_id, color, eyes, mouth, cheeks, head, neck, desk, hachimaki, updated_at)
    values (v_uid, p_color, p_eyes, p_mouth, p_cheeks, p_head, p_neck, p_desk, p_hachimaki, now())
    on conflict (user_id) do update
      set color = excluded.color, eyes = excluded.eyes, mouth = excluded.mouth,
          cheeks = excluded.cheeks, head = excluded.head, neck = excluded.neck, desk = excluded.desk,
          hachimaki = excluded.hachimaki, updated_at = now();
  exception
    when check_violation or not_null_violation then
      raise exception 'invalid_avatar';
  end;

  return public.avatar_json(v_uid);
end;
$$;

revoke execute on function public.save_avatar(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_avatar(text, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------
-- 部屋のテーマ15種
-- ---------------------------------------------------------
alter table public.rooms drop constraint rooms_theme_check;
alter table public.rooms add constraint rooms_theme_check check (theme in (
  'library', 'cafe', 'washitsu', 'space',
  'night_library', 'classroom', 'forest', 'beach', 'kotatsu', 'rooftop',
  'lodge', 'sakura', 'matsuri', 'train', 'greenhouse', 'camp',
  'aquarium', 'castle', 'clouds'));

insert into public.shop_items (item_id, kind, price, currency, sort_order) values
  ('theme:night_library', 'theme',  20, 'tomato', 3),
  ('theme:classroom',     'theme',  20, 'tomato', 4),
  ('theme:forest',        'theme',  20, 'tomato', 5),
  ('theme:beach',         'theme',  20, 'tomato', 6),
  ('theme:kotatsu',       'theme',  20, 'tomato', 7),
  ('theme:rooftop',       'theme',  20, 'tomato', 8),
  ('theme:lodge',         'theme',  50, 'tomato', 9),
  ('theme:sakura',        'theme',  50, 'tomato', 10),
  ('theme:matsuri',       'theme',  50, 'tomato', 11),
  ('theme:train',         'theme',  50, 'tomato', 12),
  ('theme:greenhouse',    'theme',  50, 'tomato', 13),
  ('theme:camp',          'theme',  50, 'tomato', 14),
  ('theme:aquarium',      'theme', 100, 'tomato', 15),
  ('theme:castle',        'theme', 100, 'tomato', 16),
  ('theme:clouds',        'theme', 100, 'tomato', 17);
