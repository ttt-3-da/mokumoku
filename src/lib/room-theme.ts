/**
 * 部屋のテーマ（フェーズ13）と、窓の外の時間帯。
 * テーマIDは DB（rooms.theme の check 制約）と一致させること。
 */
export const ROOM_THEMES = {
  library: { label: "図書館", icon: "📚", wall: "#efe3cf", floor: "#d9c3a0", desk: "#c9a574", deskEdge: "#b08b5c" },
  cafe: { label: "カフェ", icon: "☕", wall: "#f3e2d3", floor: "#c9a283", desk: "#a87b5a", deskEdge: "#8d6446" },
  washitsu: { label: "和室", icon: "🍵", wall: "#efe8d2", floor: "#cfd6a3", desk: "#b5895b", deskEdge: "#946c43" },
  space: { label: "宇宙", icon: "🚀", wall: "#2c3150", floor: "#3a4066", desk: "#8d96c4", deskEdge: "#6e77a6" },
} as const;

export type RoomTheme = keyof typeof ROOM_THEMES;

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
