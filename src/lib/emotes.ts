/**
 * エモート：自分のもちが動きをして、部屋のみんなに見える。
 * スタンプと違って相手を選ばず、ポモドーロの集中中でも使える（3秒に1回まで）。
 * 無料のもの以外は、ショップで買ったもの（'emote:ID'）だけ使える。ID と値段は
 * supabase/migrations/20261116000300_stamps_emotes_shop.sql と一致させる。
 */
export const EMOTES = [
  { id: "wave", group: "あいさつ", label: "よろしく", free: true },
  { id: "bow", group: "あいさつ", label: "ありがとう", free: true },
  { id: "nod", group: "あいさつ", label: "うんうん" },
  { id: "cheer", group: "あいさつ", label: "おうえん" },
  { id: "joy", group: "気分", label: "やったー", free: true },
  { id: "stretch", group: "気分", label: "のび〜" },
  { id: "doze", group: "気分", label: "うとうと" },
  { id: "jiggle", group: "気分", label: "ぷるぷる" },
  { id: "blush", group: "気分", label: "てれてれ" },
  { id: "shock", group: "気分", label: "ガーン" },
  { id: "relief", group: "気分", label: "ほっ" },
  { id: "hungry", group: "気分", label: "おなかすいた" },
  { id: "groove", group: "気分", label: "ノリノリ" },
  { id: "spin", group: "気分", label: "くるっ" },
  { id: "tall", group: "気分", label: "のびーる" },
  { id: "idea", group: "勉強", label: "ひらめいた" },
  { id: "sweat", group: "勉強", label: "もうひと息" },
  { id: "fire", group: "勉強", label: "やる気" },
  { id: "hmm", group: "勉強", label: "ふむふむ" },
  { id: "shine", group: "勉強", label: "キラーン" },
] as const satisfies readonly { id: string; group: string; label: string; free?: boolean }[];

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

export function isFreeEmote(id: string): boolean {
  const e = BY_ID.get(id);
  return Boolean(e && "free" in e && e.free);
}

/** 使えるエモート（無料＋買ったもの 'emote:ID'） */
export function canUseEmote(id: string, owned: ReadonlySet<string>): boolean {
  return isFreeEmote(id) || owned.has(`emote:${id}`);
}

/** グループごとにまとめる（パレットの見出し用）。list を渡すとその中だけ */
export function emoteGroups(list: readonly Emote[] = EMOTES): { group: string; items: Emote[] }[] {
  const groups: { group: string; items: Emote[] }[] = [];
  for (const e of list) {
    const g = groups.find((x) => x.group === e.group);
    if (g) g.items.push(e);
    else groups.push({ group: e.group, items: [e] });
  }
  return groups;
}
