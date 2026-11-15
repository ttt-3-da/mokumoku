/**
 * もちのパーツ定義。DB（avatars テーブルの check 制約、unlocks.item_id）と一致させること。
 * 画像は保存せず、パーツIDだけを保存して表示時に SVG を組み立てる。
 */

/** 体の色の定義。paint があると上下の色違い（bands）やグラデーション（gradient）で塗る */
export type ColorDef = {
  label: string;
  /** 単色のときの色。塗り分けのときも、手などの小さな部分はこの色 */
  fill: string;
  edge: string;
  paint?: { kind: "bands" | "gradient"; stops: readonly string[] };
  /** 光の反射を描く（きんいろ） */
  shine?: boolean;
  /** 体が暗い色なので、目や口を明るい色で描く */
  dark?: boolean;
};

const colorDefs = {
  // 無料
  shiro: { label: "白もち", fill: "#fffdf7", edge: "#e6d9c6" },
  sakura: { label: "さくら", fill: "#ffd6df", edge: "#eeaabb" },
  yomogi: { label: "よもぎ", fill: "#bfdcab", edge: "#93bd86" },
  // ここから有料（値段は DB の shop_items）
  kinako: { label: "きなこ", fill: "#f2d7a0", edge: "#d8b06c" },
  goma: { label: "ごま", fill: "#9b958d", edge: "#77716a" },
  ramune: { label: "ラムネ", fill: "#c4e6f4", edge: "#8ec6de" },
  yuzu: { label: "ゆず", fill: "#ffe680", edge: "#e6c54a" },
  murasakiimo: { label: "むらさきいも", fill: "#cdb7e6", edge: "#a88dcb" },
  milk: { label: "ミルク", fill: "#fff6e6", edge: "#ead8bd" },
  zunda: { label: "ずんだ", fill: "#cfe59a", edge: "#a8c66d" },
  kuri: { label: "くり", fill: "#e3b26e", edge: "#c18c45" },
  mikan: { label: "みかん", fill: "#ffbe73", edge: "#e89a45" },
  houjicha: { label: "ほうじ茶", fill: "#c9a07e", edge: "#a67b5a" },
  momo: { label: "もも", fill: "#ffd0cc", edge: "#eba7a1" },
  lemon: { label: "レモン", fill: "#fff3a3", edge: "#e6d062" },
  anko: { label: "あんこ", fill: "#9c6b6b", edge: "#7a4d4d", dark: true },
  soda: { label: "ソーダ", fill: "#a8def5", edge: "#7cc2e0" },
  budou: { label: "ぶどう", fill: "#c5b0e6", edge: "#9f86c9" },
  matcha: { label: "抹茶", fill: "#a3bf7f", edge: "#7f9c5c" },
  ichigo: { label: "いちご", fill: "#ffa8b5", edge: "#e8808f" },
  choco: { label: "チョコ", fill: "#9a6e52", edge: "#77503a", dark: true },
  mint: { label: "ミント", fill: "#bdf0dc", edge: "#8fd1b8" },
  caramel: { label: "キャラメル", fill: "#e8b47a", edge: "#c99052" },
  blueberry: { label: "ブルーベリー", fill: "#9faee6", edge: "#7787c9" },
  hiyoko: { label: "ひよこ", fill: "#ffe48f", edge: "#e6c55c" },
  warabi: { label: "わらび", fill: "#e3d6b3", edge: "#c4b48c" },
  kuromitsu: { label: "くろみつ", fill: "#6e5644", edge: "#50392b", dark: true },
  suika: { label: "すいか", fill: "#ff9494", edge: "#e86b6b" },
  yozora: { label: "よぞら", fill: "#5a6199", edge: "#434a80", dark: true },
  yuki: { label: "ゆき", fill: "#f2f7ff", edge: "#cfdcf0" },
  ichigodaifuku: {
    label: "いちご大福",
    fill: "#fffdf7",
    edge: "#eebac2",
    paint: { kind: "bands", stops: ["#fffdf7", "#ffa8b5"] },
  },
  sanshokudango: {
    label: "三色だんご",
    fill: "#fffdf7",
    edge: "#d9c9b0",
    paint: { kind: "bands", stops: ["#ffd6df", "#fffdf7", "#bfdcab"] },
  },
  creamsoda: {
    label: "クリームソーダ",
    fill: "#fffdf7",
    edge: "#88c98a",
    paint: { kind: "bands", stops: ["#fffdf7", "#9ee0a0"] },
  },
  purin: {
    label: "プリン",
    fill: "#ffe9a3",
    edge: "#d7b06b",
    paint: { kind: "bands", stops: ["#c98a3e", "#ffe9a3", "#ffe9a3"] },
  },
  yuuyake: {
    label: "ゆうやけ",
    fill: "#f0a9a0",
    edge: "#b8909e",
    paint: { kind: "gradient", stops: ["#ffb36b", "#f59a9a", "#c39be0"] },
  },
  rainbow: {
    label: "レインボー",
    fill: "#fff19a",
    edge: "#c9b8d8",
    paint: { kind: "bands", stops: ["#ff9aa2", "#ffc785", "#fff19a", "#b5ead7", "#a0d2f0", "#c7b3ec"] },
  },
  aurora: {
    label: "オーロラ",
    fill: "#9fd6f5",
    edge: "#9fb8d8",
    paint: { kind: "gradient", stops: ["#b8f2d0", "#9fd6f5", "#c8b4f0"] },
  },
  kiniro: {
    label: "きんいろ",
    fill: "#f2c94c",
    edge: "#c9962a",
    paint: { kind: "gradient", stops: ["#fff1a8", "#f2c94c", "#d9a531"] },
    shine: true,
  },
} satisfies Record<string, ColorDef>;

export const COLORS: Record<keyof typeof colorDefs, ColorDef> = colorDefs;

/** 無料の色（それ以外はショップで買う） */
export const FREE_COLORS: readonly AvatarColor[] = ["shiro", "sakura", "yomogi"];

/** ショップの品物ID（DB の shop_items.item_id） */
export function shopItemId(kind: "color", value: string): string {
  return `${kind}:${value}`;
}

export const EYES = {
  dot: "点",
  smile: "にっこり",
  sparkle: "キラキラ",
  sleepy: "ねむそう",
  glasses: "メガネ付き",
  // ここから有料（値段は DB の shop_items）
  chibi: "ちび点",
  tare: "たれ目",
  tsuri: "つり目",
  manmaru: "まんまる",
  hoso: "ほそ目",
  hohoemi: "ほほえみ",
  jito: "ジト目",
  usagi: "うさぎ目",
  wink: "ウインク",
  bikkuri: "びっくり",
  gyu: "＞＜",
  toron: "とろん",
  uruuru: "うるうる",
  guruguru: "ぐるぐる",
  shiitake: "しいたけ",
  kiri: "きりっ",
  komari: "こまり",
  oko: "おこ",
  namida: "なみだ",
  heart: "ハート",
  star: "ほし",
  neko: "ねこ目",
  pacchiri: "ぱっちり",
  marumegane: "まるメガネ",
  sunglasses: "サングラス",
  monocle: "片メガネ",
  shoujo: "少女まんが",
  goggles: "ゴーグル",
  diamond: "ダイヤ",
  nijiiro: "にじいろの瞳",
} as const;

export const MOUTHS = {
  omega: "ω",
  small: "小さな丸",
  smile: "にっこり",
  frown: "への字",
  // ここから有料（値段は DB の shop_items）
  ni: "にっ",
  ho: "ほっ",
  musu: "むすっ",
  pokan: "ぽかん",
  unya: "うにゃ",
  niyari: "にやり",
  shobon: "しょぼん",
  puku: "ぷくっ",
  pero: "ぺろっ",
  chu: "ちゅー",
  waai: "わーい",
  akubi: "あくび",
  mogumogu: "もぐもぐ",
  gaan: "がーん",
  giza: "ギザギザ",
  kiba: "きば",
  usagi: "うさぎ",
  fuu: "ふーっ",
  ahiru: "アヒル口",
  nikko: "にこっ",
  tehe: "てへっ",
  nekoguchi: "ねこ口",
  chobihige: "ちょびひげ",
  mask: "マスク",
  kaiser: "カイゼルひげ",
  oshaburi: "おしゃぶり",
  pan: "くわえパン",
  hana: "くわえ花",
  kira: "キラッ",
  heart: "ハートの口",
} as const;

export const CHEEKS = {
  none: "なし",
  pink: "ピンク",
  orange: "オレンジ",
  // ここから有料（値段は DB の shop_items）
  usupink: "うすピンク",
  aka: "あか",
  mizuiro: "みずいろ",
  murasaki: "むらさき",
  midori: "みどり",
  kiiro: "きいろ",
  chiisai: "ちいさい丸",
  hokuro: "ほくろ",
  ookii: "大きいもも色",
  tate: "たて長",
  yoko: "よこ長",
  tere: "てれ",
  sobakasu: "そばかす",
  fuwa: "ふわっと",
  guruguru: "ぐるぐる",
  shizuku: "しずく",
  ase: "汗",
  star: "星",
  bandage: "ばんそうこう",
  nekohige: "ねこひげ",
  happa: "葉っぱ",
  oko: "おこマーク",
  heart: "ハート",
  kirakira: "キラキラ",
  sakura: "さくらの花びら",
  yuki: "雪の結晶",
  onpu: "音符",
  ichigo: "いちご",
  sticker: "星のシール",
  niji: "にじ",
} as const;

export const HEAD_ITEMS = {
  none: "なし",
  ribbon: "リボン",
  leaf: "葉っぱ",
  crown: "王冠",
  // ここから有料（値段は DB の shop_items）
  ahoge: "アホ毛",
  odango: "おだんご",
  bigribbon: "大きいリボン",
  nekomimi: "ねこみみ",
  usamimi: "うさみみ",
  kumamimi: "くまみみ",
  chonmage: "ちょんまげ",
  beret: "ベレー帽",
  knit: "ニット帽",
  tsuno: "つの",
  mugiwara: "麦わら帽子",
  hanakanmuri: "花かんむり",
  headphones: "ヘッドホン",
  mahou: "魔法の帽子",
  tenshi: "天使の輪",
} as const;

export const DESK_ITEMS = {
  none: "なし",
  mug: "マグカップ",
  lamp: "ランプ",
  plant: "観葉植物",
  pet: "ペットのミニもち",
  // ここから有料（値段は DB の shop_items）
  pencils: "えんぴつ立て",
  onigiri: "おにぎり",
  books: "本の山",
  sunadokei: "砂時計",
  mezamashi: "めざまし時計",
  saboten: "サボテン",
  cake: "ケーキ",
  globe: "地球儀",
  kingyo: "金魚鉢",
  nekonui: "ねこのぬいぐるみ",
} as const;

/** 首の小物（頭の小物と同時に付けられる）。なし以外は有料 */
export const NECK_ITEMS = {
  none: "なし",
  yodare: "よだれかけ",
  choutie: "ちょうネクタイ",
  muffler: "マフラー",
  scarf: "スカーフ",
  pendant: "ペンダント",
} as const;

export const HACHIMAKI = {
  red: "あか",
  indigo: "あい色",
} as const;

/** フォルム（もちの形）。まる以外はショップで買う（'form:ID'） */
export const FORMS = {
  round: "まる",
  square: "しかく",
  double: "2段もち",
  triple: "3段もち",
  king: "キングもち",
} as const;
export type AvatarForm = keyof typeof FORMS;

export type AvatarColor = keyof typeof COLORS;
export type AvatarEyes = keyof typeof EYES;
export type AvatarMouth = keyof typeof MOUTHS;
export type AvatarCheeks = keyof typeof CHEEKS;
export type AvatarHead = keyof typeof HEAD_ITEMS;
export type AvatarDesk = keyof typeof DESK_ITEMS;
export type AvatarNeck = keyof typeof NECK_ITEMS;
export type AvatarHachimaki = keyof typeof HACHIMAKI;

export type Avatar = {
  color: AvatarColor;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  cheeks: AvatarCheeks;
  head: AvatarHead;
  desk: AvatarDesk;
  hachimaki: AvatarHachimaki;
  neck: AvatarNeck;
  /** もちの形（古いデータには無いので省略可） */
  form?: AvatarForm;
};

export const DEFAULT_AVATAR: Avatar = {
  color: "shiro",
  eyes: "dot",
  mouth: "omega",
  cheeks: "pink",
  head: "none",
  desk: "none",
  hachimaki: "red",
  neck: "none",
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
    neck: pick(v.neck, NECK_ITEMS, DEFAULT_AVATAR.neck),
    hachimaki: pick(v.hachimaki, HACHIMAKI, DEFAULT_AVATAR.hachimaki),
    form: pick(v.form, FORMS, "round"),
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

/** ショップで売っているもちのパーツの種類（DB の shop_items.kind） */
export type ShopPart = "color" | "eyes" | "mouth" | "cheeks" | "head" | "neck" | "desk";

const PART_LABELS: Record<ShopPart, Record<string, string>> = {
  color: Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v.label])),
  eyes: EYES,
  mouth: MOUTHS,
  cheeks: CHEEKS,
  head: HEAD_ITEMS,
  neck: NECK_ITEMS,
  desk: DESK_ITEMS,
};

/** 'eyes:heart' → { part: 'eyes', value: 'heart', label: 'ハート' }。知らない品物は null */
export function parseShopItem(itemId: string): { part: ShopPart; value: string; label: string } | null {
  const [part, value] = itemId.split(":");
  if (!(part in PART_LABELS)) return null;
  const label = PART_LABELS[part as ShopPart][value];
  return label ? { part: part as ShopPart, value, label } : null;
}
