/**
 * 実績バッジ。ID ともらえるコインは DB（badge_defs）と、条件は evaluate_badges_internal と合わせること
 */
export type BadgeDef = { icon: string; name: string; desc: string; coins: number };

export const BADGES = {
  first_session: { icon: "🌱", name: "はじめの一歩", desc: "初めて1分以上勉強した", coins: 5 },
  early_bird: { icon: "🌅", name: "朝活", desc: "朝5〜8時に入室して25分以上勉強した", coins: 10 },
  night_owl: { icon: "🦉", name: "夜ふかし", desc: "夜22時〜3時に入室して25分以上勉強した", coins: 10 },
  long_2h: { icon: "🏔️", name: "ロングラン", desc: "1回で2時間勉強した", coins: 15 },
  day_3h: { icon: "🔥", name: "1日3時間", desc: "1日に3時間勉強した", coins: 10 },
  day_5h: { icon: "💪", name: "1日5時間", desc: "1日に5時間勉強した", coins: 20 },
  day_8h: { icon: "🦸", name: "1日8時間", desc: "1日に8時間勉強した", coins: 30 },
  pomo_1: { icon: "🍅", name: "初ポモドーロ", desc: "ポモドーロを1回やりきった", coins: 5 },
  pomo_10: { icon: "🧺", name: "10ポモドーロ", desc: "ポモドーロを合計10回", coins: 10 },
  pomo_100: { icon: "🚜", name: "100ポモドーロ", desc: "ポモドーロを合計100回", coins: 30 },
  pomo_day_8: { icon: "🎯", name: "1日8ポモドーロ", desc: "1日にポモドーロを8回", coins: 20 },
  streak_3: { icon: "📅", name: "3日連続", desc: "3日続けて勉強した", coins: 5 },
  streak_7: { icon: "🗓️", name: "7日連続", desc: "7日続けて勉強した", coins: 10 },
  streak_14: { icon: "⭐", name: "14日連続", desc: "14日続けて勉強した", coins: 20 },
  streak_30: { icon: "🌟", name: "30日連続", desc: "30日続けて勉強した", coins: 30 },
  total_10h: { icon: "🥉", name: "合計10時間", desc: "これまでの合計が10時間", coins: 10 },
  total_50h: { icon: "🥈", name: "合計50時間", desc: "これまでの合計が50時間", coins: 20 },
  total_100h: { icon: "🥇", name: "合計100時間", desc: "これまでの合計が100時間", coins: 30 },
  total_300h: { icon: "🏆", name: "合計300時間", desc: "これまでの合計が300時間", coins: 30 },
  rooms_5: { icon: "🧭", name: "部屋めぐり", desc: "5つの部屋で勉強した", coins: 10 },
  weekly_goal: { icon: "🏁", name: "目標達成", desc: "週の目標を初めて達成した", coins: 10 },
  note_first: { icon: "📝", name: "ふり返り", desc: "記録に初めてメモを書いた", coins: 5 },
  first_follow: { icon: "🤝", name: "なかま", desc: "初めてだれかをフォローした", coins: 5 },
  first_purchase: { icon: "🛍️", name: "おかいもの", desc: "ショップで初めて買い物をした", coins: 5 },
  theme_buy: { icon: "🎨", name: "模様がえ", desc: "部屋のテーマを🍅で買った", coins: 10 },
  room_create: { icon: "🏠", name: "部屋づくり", desc: "初めて部屋を作った", coins: 5 },
} as const satisfies Record<string, BadgeDef>;

export type BadgeId = keyof typeof BADGES;

export const BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export function isBadgeId(v: unknown): v is BadgeId {
  return typeof v === "string" && Object.hasOwn(BADGES, v);
}
