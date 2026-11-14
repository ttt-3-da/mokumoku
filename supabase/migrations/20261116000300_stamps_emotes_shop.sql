-- =========================================================
-- スタンプとエモートをショップで買えるようにする（docs/shop-catalog.md）
-- 無料のもの（スタンプ：ぱちぱち・がんばれ、エモート：よろしく・ありがとう・やったー）は品物に入れない。
-- ID は src/lib/stamps.ts・src/lib/emotes.ts と一致させる。
-- スタンプ・エモートは Realtime で直接届くので、持っているかは画面の側で確かめる
-- =========================================================

alter table public.shop_items drop constraint shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('color', 'eyes', 'mouth', 'cheeks', 'head', 'neck', 'desk', 'theme', 'stamp', 'emote'));

insert into public.shop_items (item_id, kind, price, currency, sort_order) values
  ('stamp:coffee', 'stamp', 10, 'coin', 202),
  ('stamp:fight', 'stamp', 10, 'coin', 203),
  ('stamp:nice', 'stamp', 10, 'coin', 204),
  ('stamp:morning', 'stamp', 10, 'coin', 205),
  ('stamp:night', 'stamp', 10, 'coin', 206),
  ('stamp:otsukare', 'stamp', 15, 'coin', 207),
  ('stamp:thanks', 'stamp', 15, 'coin', 208),
  ('stamp:wow', 'stamp', 15, 'coin', 209),
  ('stamp:wakaru', 'stamp', 15, 'coin', 210),
  ('stamp:focus', 'stamp', 15, 'coin', 211),
  ('stamp:pat', 'stamp', 20, 'coin', 212),
  ('stamp:dango', 'stamp', 20, 'coin', 213),
  ('stamp:heart', 'stamp', 20, 'coin', 214),
  ('stamp:nebare', 'stamp', 20, 'coin', 215),
  ('stamp:hanamaru', 'stamp', 25, 'coin', 216),
  ('stamp:congrats', 'stamp', 25, 'coin', 217),
  ('stamp:daruma', 'stamp', 30, 'coin', 218),
  ('stamp:crown', 'stamp', 30, 'coin', 219),
  ('emote:nod', 'emote', 15, 'coin', 303),
  ('emote:stretch', 'emote', 15, 'coin', 304),
  ('emote:doze', 'emote', 15, 'coin', 305),
  ('emote:idea', 'emote', 15, 'coin', 306),
  ('emote:sweat', 'emote', 15, 'coin', 307),
  ('emote:fire', 'emote', 15, 'coin', 308),
  ('emote:jiggle', 'emote', 20, 'coin', 309),
  ('emote:blush', 'emote', 20, 'coin', 310),
  ('emote:shock', 'emote', 20, 'coin', 311),
  ('emote:relief', 'emote', 20, 'coin', 312),
  ('emote:hmm', 'emote', 20, 'coin', 313),
  ('emote:hungry', 'emote', 20, 'coin', 314),
  ('emote:groove', 'emote', 30, 'coin', 315),
  ('emote:cheer', 'emote', 30, 'coin', 316),
  ('emote:shine', 'emote', 30, 'coin', 317),
  ('emote:spin', 'emote', 40, 'coin', 318),
  ('emote:tall', 'emote', 40, 'coin', 319);
