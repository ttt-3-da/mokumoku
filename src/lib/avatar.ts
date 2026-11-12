/**
 * もちのパーツ定義。DB（avatars テーブルの check 制約、unlocks.item_id）と一致させること。
 * 画像は保存せず、パーツIDだけを保存して表示時に SVG を組み立てる。
 */

export const COLORS = {
  shiro: { label: "白もち", fill: "#fffdf7", edge: "#e6d9c6" },
  sakura: { label: "さくら", fill: "#ffd6df", edge: "#eeaabb" },
  yomogi: { label: "よもぎ", fill: "#bfdcab", edge: "#93bd86" },
  kinako: { label: "きなこ", fill: "#f2d7a0", edge: "#d8b06c" },
  goma: { label: "ごま", fill: "#9b958d", edge: "#77716a" },
  ramune: { label: "ラムネ", fill: "#c4e6f4", edge: "#8ec6de" },
  yuzu: { label: "ゆず", fill: "#ffe680", edge: "#e6c54a" },
  murasakiimo: { label: "むらさきいも", fill: "#cdb7e6", edge: "#a88dcb" },
} as const;

export const EYES = {
  dot: "点",
  smile: "にっこり",
  sparkle: "キラキラ",
  sleepy: "ねむそう",
  glasses: "メガネ付き",
} as const;

export const MOUTHS = {
  omega: "ω",
  small: "小さな丸",
  smile: "にっこり",
  frown: "への字",
} as const;

export const CHEEKS = {
  none: "なし",
  pink: "ピンク",
  orange: "オレンジ",
} as const;

export const HEAD_ITEMS = {
  none: "なし",
  ribbon: "リボン",
  leaf: "葉っぱ",
  crown: "王冠",
} as const;

export const DESK_ITEMS = {
  none: "なし",
  mug: "マグカップ",
  lamp: "ランプ",
  plant: "観葉植物",
  pet: "ペットのミニもち",
} as const;

export const HACHIMAKI = {
  red: "あか",
  indigo: "あい色",
} as const;

export type AvatarColor = keyof typeof COLORS;
export type AvatarEyes = keyof typeof EYES;
export type AvatarMouth = keyof typeof MOUTHS;
export type AvatarCheeks = keyof typeof CHEEKS;
export type AvatarHead = keyof typeof HEAD_ITEMS;
export type AvatarDesk = keyof typeof DESK_ITEMS;
export type AvatarHachimaki = keyof typeof HACHIMAKI;

export type Avatar = {
  color: AvatarColor;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  cheeks: AvatarCheeks;
  head: AvatarHead;
  desk: AvatarDesk;
  hachimaki: AvatarHachimaki;
};

export const DEFAULT_AVATAR: Avatar = {
  color: "shiro",
  eyes: "dot",
  mouth: "omega",
  cheeks: "pink",
  head: "none",
  desk: "none",
  hachimaki: "red",
};

/** 解放制のアイテム（item_id → 解放条件の説明）。解放の判定はフェーズ12で実装する */
export const UNLOCKABLE_ITEMS = {
  "head:leaf": "初めての入室",
  "desk:mug": "累計10時間",
  "desk:lamp": "累計25時間",
  "hachimaki:indigo": "7日連続",
  "desk:plant": "累計50時間",
  "head:crown": "30日連続",
  "desk:pet": "累計100時間",
} as const;

export type UnlockItemId = keyof typeof UNLOCKABLE_ITEMS;

export const UNLOCK_ITEM_LABEL: Record<UnlockItemId, string> = {
  "head:leaf": "葉っぱ",
  "desk:mug": "マグカップ",
  "desk:lamp": "ランプ",
  "hachimaki:indigo": "あい色ハチマキ",
  "desk:plant": "観葉植物",
  "head:crown": "王冠",
  "desk:pet": "ペットのミニもち",
};

export function itemId(part: "head" | "desk" | "hachimaki", value: string): string {
  return `${part}:${value}`;
}

/** そのアイテムを使えるか（解放制でなければ常に使える） */
export function isItemAvailable(id: string, unlocked: ReadonlySet<string>): boolean {
  return !(id in UNLOCKABLE_ITEMS) || unlocked.has(id);
}

function pick<T extends string>(value: unknown, options: Record<T, unknown>, fallback: T): T {
  return typeof value === "string" && Object.hasOwn(options, value) ? (value as T) : fallback;
}

/**
 * DB や Presence から来た値を Avatar にする。知らない値はデフォルトに置き換える
 * （古いクライアントや壊れたデータが来ても表示が崩れないように）。
 */
export function parseAvatar(raw: unknown): Avatar {
  const v = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    color: pick(v.color, COLORS, DEFAULT_AVATAR.color),
    eyes: pick(v.eyes, EYES, DEFAULT_AVATAR.eyes),
    mouth: pick(v.mouth, MOUTHS, DEFAULT_AVATAR.mouth),
    cheeks: pick(v.cheeks, CHEEKS, DEFAULT_AVATAR.cheeks),
    head: pick(v.head, HEAD_ITEMS, DEFAULT_AVATAR.head),
    desk: pick(v.desk, DESK_ITEMS, DEFAULT_AVATAR.desk),
    hachimaki: pick(v.hachimaki, HACHIMAKI, DEFAULT_AVATAR.hachimaki),
  };
}

/**
 * まばたきのタイミングをキャラごとにずらすため、ユーザーIDから決まった値を作る。
 * 戻り値は 0〜1。
 */
export function seededRandom(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** 連続集中の時間に応じた見た目の段階（1時間超で湯気、2時間超でほっぺ赤＋キラキラ目） */
export function heatLevel(focusMinutes: number): 0 | 1 | 2 {
  if (focusMinutes > 120) return 2;
  if (focusMinutes > 60) return 1;
  return 0;
}
