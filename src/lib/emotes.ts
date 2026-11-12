/**
 * エモート：自分のもちが動きをして、部屋のみんなに見える。
 * スタンプと違って相手を選ばず、ポモドーロの集中中でも使える（3秒に1回まで）。
 */
export const EMOTES = [
  { id: "wave", group: "あいさつ", label: "よろしく", icon: "👋" },
  { id: "bow", group: "あいさつ", label: "ありがとう", icon: "🙇" },
  { id: "nod", group: "あいさつ", label: "うんうん", icon: "😌" },
  { id: "joy", group: "気分", label: "やったー", icon: "🎵" },
  { id: "stretch", group: "気分", label: "のび〜", icon: "🙆" },
  { id: "doze", group: "気分", label: "うとうと", icon: "💤" },
  { id: "idea", group: "勉強", label: "ひらめいた", icon: "💡" },
  { id: "sweat", group: "勉強", label: "もうひと息", icon: "💦" },
  { id: "fire", group: "勉強", label: "やる気", icon: "🔥" },
] as const;

export type EmoteId = (typeof EMOTES)[number]["id"];
export type Emote = (typeof EMOTES)[number];

export const EMOTE_INTERVAL_MS = 3000;
/** 動きと吹き出しを出しておく時間 */
export const EMOTE_DURATION_MS = 2600;

const BY_ID = new Map<string, Emote>(EMOTES.map((e) => [e.id, e]));

export function getEmote(id: string): Emote | undefined {
  return BY_ID.get(id);
}

export type EmoteEvent = { id: string; from: string; emote: EmoteId };

/** Broadcast で受け取った値がエモートとして正しい形か */
export function parseEmoteEvent(raw: unknown): EmoteEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.from !== "string" || typeof v.emote !== "string") return null;
  if (!BY_ID.has(v.emote)) return null;
  return { id: v.id, from: v.from, emote: v.emote as EmoteId };
}

/** 送ってよければ送信時刻を記録して true（3秒以内の連打は false） */
export function claimEmoteSlot(last: { current: number | null }, now = Date.now()): boolean {
  if (last.current !== null && now - last.current < EMOTE_INTERVAL_MS) return false;
  last.current = now;
  return true;
}

/** グループごとにまとめる（パレットの見出し用） */
export function emoteGroups(): { group: string; items: Emote[] }[] {
  const groups: { group: string; items: Emote[] }[] = [];
  for (const e of EMOTES) {
    const g = groups.find((x) => x.group === e.group);
    if (g) g.items.push(e);
    else groups.push({ group: e.group, items: [e] });
  }
  return groups;
}
