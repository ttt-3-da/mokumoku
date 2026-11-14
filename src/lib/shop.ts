/** ショップの並び順（自分で選べる） */
export const SHOP_SORTS = {
  recommended: "おすすめ順",
  cheap: "安い順",
  expensive: "高い順",
  newest: "新しい順",
  unowned: "持っていないものを先に",
} as const;

export type ShopSort = keyof typeof SHOP_SORTS;

export type SortableItem = { item_id: string; price: number; sort_order: number; released_at: string };

export function parseShopSort(v: unknown): ShopSort {
  return typeof v === "string" && Object.hasOwn(SHOP_SORTS, v) ? (v as ShopSort) : "recommended";
}

/** 並び替えた新しい配列を返す。同じ値どうしは「おすすめ順」で並べる */
export function sortShopItems<T extends SortableItem>(items: readonly T[], owned: ReadonlySet<string>, mode: ShopSort): T[] {
  const byRecommended = (a: T, b: T) => a.sort_order - b.sort_order || a.item_id.localeCompare(b.item_id);
  const compare: Record<ShopSort, (a: T, b: T) => number> = {
    recommended: byRecommended,
    cheap: (a, b) => a.price - b.price || byRecommended(a, b),
    expensive: (a, b) => b.price - a.price || byRecommended(a, b),
    newest: (a, b) => Date.parse(b.released_at) - Date.parse(a.released_at) || byRecommended(a, b),
    unowned: (a, b) => Number(owned.has(a.item_id)) - Number(owned.has(b.item_id)) || byRecommended(a, b),
  };
  return [...items].sort(compare[mode]);
}

/** その値段を買えるか、足りなければあと何枚か */
export function coinsShort(balance: number, price: number): number {
  return Math.max(0, price - balance);
}

/** ショップの種類のタブ */
export const SHOP_KINDS = ["color", "eyes", "mouth", "cheeks", "head", "neck", "desk", "stamp", "emote"] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];

export function parseShopKind(v: unknown): ShopKind {
  return typeof v === "string" && (SHOP_KINDS as readonly string[]).includes(v) ? (v as ShopKind) : "color";
}
