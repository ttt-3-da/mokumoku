/**
 * 部屋のテーマ（フェーズ13）と、窓の外の時間帯。
 * テーマIDは DB（rooms.theme の check 制約）と一致させること。
 */
/** 机の形（席ごとに描く） */
export type DeskStyle = "desk" | "school" | "kotatsu" | "stump" | "seat" | "cloud" | "bench" | "low" | "counter";

/** 部屋の小さな動き（ゆっくり・少なめ。見ていないタブや「動きを減らす」設定では止まる） */
export type SceneMotion =
  | "none" | "petals" | "snow" | "leaves" | "aquarium" | "twinkle" | "drift" | "lanterns" | "scenery" | "butterflies" | "waves" | "flame";

export type ThemeDef = {
  label: string;
  icon: string;
  wall: string;
  floor: string;
  desk: string;
  deskEdge: string;
  deskStyle: DeskStyle;
  /** window：壁と窓と飾り ／ scene：部屋全体が景色（窓なし） */
  backdrop: "window" | "scene";
  /** いつも夜のテーマ（夏祭り・キャンプ・夜の図書館など） */
  alwaysNight?: boolean;
  /** 背景が暗いので文字を明るくする */
  dark?: boolean;
  motion: SceneMotion;
};

const themeDefs = {
  // 無料
  library: { label: "図書館", icon: "📚", wall: "#efe3cf", floor: "#d9c3a0", desk: "#c9a574", deskEdge: "#b08b5c", deskStyle: "desk", backdrop: "window", motion: "none" },
  cafe: { label: "カフェ", icon: "☕", wall: "#f3e2d3", floor: "#c9a283", desk: "#a87b5a", deskEdge: "#8d6446", deskStyle: "desk", backdrop: "window", motion: "none" },
  // 🍅で買う
  washitsu: { label: "和室", icon: "🍵", wall: "#efe8d2", floor: "#cfd6a3", desk: "#b5895b", deskEdge: "#946c43", deskStyle: "low", backdrop: "window", motion: "none" },
  space: { label: "宇宙", icon: "🚀", wall: "#2c3150", floor: "#3a4066", desk: "#8d96c4", deskEdge: "#6e77a6", deskStyle: "desk", backdrop: "window", alwaysNight: true, dark: true, motion: "twinkle" },
  night_library: { label: "夜の図書館", icon: "🌙", wall: "#4a3a33", floor: "#3a2c26", desk: "#8d6446", deskEdge: "#6e4e34", deskStyle: "desk", backdrop: "window", alwaysNight: true, dark: true, motion: "flame" },
  classroom: { label: "教室", icon: "🏫", wall: "#f1ead8", floor: "#c9a87e", desk: "#d9b98c", deskEdge: "#b8956a", deskStyle: "school", backdrop: "window", motion: "none" },
  forest: { label: "森の中", icon: "🌲", wall: "#cfe8c4", floor: "#9cc48e", desk: "#a87b5a", deskEdge: "#8d6446", deskStyle: "stump", backdrop: "scene", motion: "leaves" },
  beach: { label: "海辺", icon: "🏖️", wall: "#bfe3f7", floor: "#f2deb0", desk: "#e8c48a", deskEdge: "#c9a066", deskStyle: "bench", backdrop: "scene", motion: "waves" },
  kotatsu: { label: "こたつ", icon: "🍊", wall: "#efe3cf", floor: "#cfd6a3", desk: "#c9a574", deskEdge: "#a8834f", deskStyle: "kotatsu", backdrop: "window", motion: "none" },
  rooftop: { label: "屋上", icon: "🏙️", wall: "#bfe3f7", floor: "#c9c6c0", desk: "#a8a29a", deskEdge: "#8a847c", deskStyle: "bench", backdrop: "scene", motion: "drift" },
  lodge: { label: "雪山のロッジ", icon: "🏔️", wall: "#8d6446", floor: "#6e4e34", desk: "#c9a574", deskEdge: "#a8834f", deskStyle: "desk", backdrop: "window", dark: true, motion: "snow" },
  sakura: { label: "桜並木", icon: "🌸", wall: "#dcefff", floor: "#cfe6b8", desk: "#c9a574", deskEdge: "#a8834f", deskStyle: "bench", backdrop: "scene", motion: "petals" },
  matsuri: { label: "夏祭り", icon: "🏮", wall: "#1f2a4d", floor: "#6b4f3a", desk: "#c0392b", deskEdge: "#922b21", deskStyle: "counter", backdrop: "scene", alwaysNight: true, dark: true, motion: "lanterns" },
  train: { label: "列車", icon: "🚃", wall: "#e8e2d4", floor: "#8a7d6a", desk: "#5a6fa8", deskEdge: "#42548a", deskStyle: "seat", backdrop: "window", motion: "scenery" },
  greenhouse: { label: "温室", icon: "🌿", wall: "#e6f5ec", floor: "#c9b89a", desk: "#f5f5f0", deskEdge: "#d6d6cc", deskStyle: "desk", backdrop: "scene", motion: "butterflies" },
  camp: { label: "星空キャンプ", icon: "⛺", wall: "#141c3a", floor: "#3d4a2f", desk: "#8d6446", deskEdge: "#6e4e34", deskStyle: "stump", backdrop: "scene", alwaysNight: true, dark: true, motion: "twinkle" },
  aquarium: { label: "水族館", icon: "🐠", wall: "#2d6fa3", floor: "#24425e", desk: "#5f87a8", deskEdge: "#476b88", deskStyle: "bench", backdrop: "scene", dark: true, motion: "aquarium" },
  castle: { label: "お城の書斎", icon: "🏰", wall: "#7a2f3a", floor: "#5a2a2a", desk: "#8d5a3a", deskEdge: "#6b4029", deskStyle: "desk", backdrop: "window", dark: true, motion: "flame" },
  clouds: { label: "雲の上", icon: "☁️", wall: "#bfe3f7", floor: "#eef6fc", desk: "#ffffff", deskEdge: "#dfe9f2", deskStyle: "cloud", backdrop: "scene", motion: "drift" },
} satisfies Record<string, ThemeDef>;

export const ROOM_THEMES: Record<keyof typeof themeDefs, ThemeDef> = themeDefs;

export type RoomTheme = keyof typeof themeDefs;

/** 無料のテーマ（ほかは部屋にたまる🍅で買う） */
export const FREE_THEMES: readonly RoomTheme[] = ["library", "cafe"];

export function parseTheme(v: unknown): RoomTheme {
  return typeof v === "string" && Object.hasOwn(ROOM_THEMES, v) ? (v as RoomTheme) : "library";
}

export type TimeOfDay = "morning" | "day" | "evening" | "night";

/** 日本時間の時刻から時間帯を決める（朝 5–10時、昼 10–16時、夕方 16–19時、夜 19–5時） */
export function timeOfDay(nowMs: number): TimeOfDay {
  const hour = (new Date(nowMs).getUTCHours() + 9) % 24;
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  morning: "朝",
  day: "昼",
  evening: "夕方",
  night: "夜",
};

/** 窓の外の空（上→下のグラデーション） */
export const SKY: Record<TimeOfDay, [string, string]> = {
  morning: ["#bfe3f7", "#fde9c8"],
  day: ["#8fcdf2", "#d7f0fb"],
  evening: ["#f6a77c", "#fbd9a0"],
  night: ["#1f2a4d", "#3b4675"],
};

/** 観葉植物の育ち具合（累計学習時間で 1〜3 段階）。50時間で解放、75時間で2、100時間で3 */
export function plantLevel(totalMinutes: number): 1 | 2 | 3 {
  if (totalMinutes >= 100 * 60) return 3;
  if (totalMinutes >= 75 * 60) return 2;
  return 1;
}
