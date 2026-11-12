-- =========================================================
-- Phase 13: 部屋のテーマ（図書館・カフェ・和室・宇宙）
-- 時間帯による窓の外の変化と、休憩中に部屋が明るくなる演出はクライアント側で行う
-- =========================================================

alter table public.rooms
  add column theme text not null default 'library'
  check (theme in ('library', 'cafe', 'washitsu', 'space'));

-- 作成時に選べて、オーナーはあとから変えられる（rooms の更新ポリシーはオーナーのみ）
grant insert (theme), update (theme) on public.rooms to authenticated;
