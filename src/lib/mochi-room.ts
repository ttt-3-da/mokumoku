/**
 * もちの部屋：壁紙と家具。無料のもの以外はショップで買う（'wallpaper:ID'・'furniture:ID'）。
 * ID は supabase/migrations/20261117000100_mochi_room_forms.sql と一致させる
 */
export const WALLPAPERS = {
  cream: { label: "クリーム", free: true, bg: "#fff6e9" },
  sakura: { label: "さくら", free: true, bg: "#ffe4ec" },
  mint: { label: "ミント", bg: "#dff3e8" },
  sky: { label: "そら", bg: "linear-gradient(#cfe8ff, #f2f9ff)" },
  stripe: { label: "ストライプ", bg: "repeating-linear-gradient(90deg, #fff3e0 0 18px, #ffe7c7 18px 36px)" },
  dots: { label: "水玉", bg: "radial-gradient(#f7b9c8 3px, transparent 3.5px) 0 0 / 22px 22px, #fff4f6" },
  check: { label: "チェック", bg: "repeating-conic-gradient(#e9f1fb 0 25%, #ffffff 0 50%) 0 0 / 36px 36px" },
  wood: { label: "木の壁", bg: "repeating-linear-gradient(90deg, #d9b48a 0 34px, #cfa77a 34px 36px)" },
  washi: { label: "和紙", bg: "radial-gradient(#e8dcc6 1px, transparent 1.5px) 0 0 / 9px 9px, #f6efe1" },
  night: { label: "よぞら", bg: "radial-gradient(#fff 1px, transparent 1.5px) 0 0 / 40px 40px, radial-gradient(#fff8 1px, transparent 1.5px) 20px 20px / 40px 40px, linear-gradient(#1c2348, #3a3f6e)" },
} as const satisfies Record<string, { label: string; free?: boolean; bg: string }>;

export type WallpaperId = keyof typeof WALLPAPERS;

export const FURNITURE = {
  plant: { label: "観葉植物", free: true, w: 13 },
  rug: { label: "ラグ", free: true, w: 30 },
  lamp: { label: "スタンドライト", free: true, w: 10 },
  cushion: { label: "クッション", w: 13 },
  clock: { label: "かけ時計", w: 10 },
  window: { label: "まど", w: 20 },
  shelf: { label: "本だな", w: 18 },
  sofa: { label: "ソファ", w: 30 },
  bed: { label: "ベッド", w: 32 },
  kotatsu: { label: "こたつ", w: 28 },
} as const satisfies Record<string, { label: string; free?: boolean; w: number }>;

export type FurnitureId = keyof typeof FURNITURE;
export type PlacedItem = { id: FurnitureId; x: number; y: number };

export const MAX_ROOM_ITEMS = 20;

export function isWallpaper(v: unknown): v is WallpaperId {
  return typeof v === "string" && Object.hasOwn(WALLPAPERS, v);
}

export function isFurniture(v: unknown): v is FurnitureId {
  return typeof v === "string" && Object.hasOwn(FURNITURE, v);
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** DB の items を、知っている家具だけ・位置は 0〜100 に直して読む */
export function parsePlacedItems(raw: unknown): PlacedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is { id: string; x: number; y: number } => typeof v === "object" && v !== null && isFurniture((v as { id?: unknown }).id))
    .filter((v) => typeof v.x === "number" && typeof v.y === "number")
    .slice(0, MAX_ROOM_ITEMS)
    .map((v) => ({ id: v.id as FurnitureId, x: clamp(v.x), y: clamp(v.y) }));
}

export function ownsWallpaper(id: WallpaperId, owned: ReadonlySet<string>): boolean {
  const w: { label: string; free?: boolean } = WALLPAPERS[id];
  return Boolean(w.free) || owned.has(`wallpaper:${id}`);
}

export function ownsFurniture(id: FurnitureId, owned: ReadonlySet<string>): boolean {
  const f: { label: string; free?: boolean } = FURNITURE[id];
  return Boolean(f.free) || owned.has(`furniture:${id}`);
}

/**
 * はねまわるもちの1コマ分の動き。壁にぶつかったら跳ね返り、床では少しずつ止まる。
 * 位置と速さは部屋の大きさ（px）で扱う
 */
export type Body = { x: number; y: number; vx: number; vy: number };

export function stepBounce(b: Body, dt: number, w: number, h: number, size: number): Body & { hit: boolean } {
  const g = 1800; // 重力（px/秒²）
  let { x, y, vx, vy } = b;
  vy += g * dt;
  x += vx * dt;
  y += vy * dt;
  let hit = false;
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  if (x < 0) [x, vx, hit] = [0, -vx * 0.75, true];
  if (x > maxX) [x, vx, hit] = [maxX, -vx * 0.75, true];
  if (y < 0) [y, vy, hit] = [0, -vy * 0.75, true];
  if (y > maxY) {
    y = maxY;
    if (Math.abs(vy) > 120) hit = true;
    vy = -vy * 0.62;
    vx *= 0.9; // 床では転がりながら止まる
    if (Math.abs(vy) < 60) vy = 0;
  }
  return { x, y, vx, vy, hit };
}
