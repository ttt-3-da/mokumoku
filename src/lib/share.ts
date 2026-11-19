import { parseAvatar, type Avatar } from "@/lib/avatar";
import { formatMinutes } from "@/lib/pomodoro";

/** シェアされた記録カードの中身（get_shared_session） */
export type SharedSession = {
  displayName: string;
  avatar: Avatar;
  minutes: number;
  pomodoros: number;
  todosDone: number;
  endedAt: string;
};

export function parseSharedSession(raw: unknown): SharedSession | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.display_name !== "string" || typeof r.minutes !== "number" || typeof r.ended_at !== "string") return null;
  return {
    displayName: r.display_name,
    avatar: parseAvatar(r.avatar),
    minutes: r.minutes,
    pomodoros: typeof r.pomodoros === "number" ? r.pomodoros : 0,
    todosDone: typeof r.todos_done === "number" ? r.todos_done : 0,
    endedAt: r.ended_at,
  };
}

/** X に投稿するときの文 */
export function shareText(minutes: number): string {
  return `${formatMinutes(minutes)}勉強しました📚\nもちといっしょに、もくもく自習室で。\n#Mokumoku #勉強垢さんと繋がりたい`;
}

export function shareUrl(origin: string, sessionId: string): string {
  return `${origin}/s/${sessionId}`;
}

export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text, url }).toString()}`;
}

const dateFormat = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });

export function shareDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/**
 * 記録カードの画像に出す字だけを集めたもの（字を絞ってフォントを小さく読み込むため）。
 * 表示名は画像に入れない（ページのほうに出す）
 */
export const CARD_GLYPHS = "0123456789/:時間分勉強しましたポモドーロ回ToDo個おわらせた記録もくもく自習室Mokumoku年月日の";
