-- =========================================================
-- 頭の小物「紳士のハット」（赤いシルクハット）を足す。🪙100
-- ID は src/lib/avatar.ts の HEAD_ITEMS と一致させる
-- =========================================================

alter table public.avatars drop constraint avatars_head_check;
alter table public.avatars add constraint avatars_head_check check (head in (
  'none', 'ribbon', 'leaf', 'crown',
  'ahoge', 'odango', 'bigribbon', 'nekomimi', 'usamimi', 'kumamimi', 'chonmage', 'beret',
  'knit', 'tsuno', 'mugiwara', 'hanakanmuri', 'headphones', 'mahou', 'tenshi', 'silkhat'));

insert into public.shop_items (item_id, kind, price, currency, sort_order) values
  ('head:silkhat', 'head', 100, 'coin', 16);
