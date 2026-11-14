/**
 * スタンプ：相手のもちに飛んでいく小さな絵。送った人のもちがポーズをとる。
 * 無料のもの以外は、ショップで買ったもの（'stamp:ID'）だけ使える。
 * ID と値段は supabase/migrations/20261116000300_stamps_emotes_shop.sql と一致させる
 */
export const STAMPS = [
  { id: "clap", label: "ぱちぱち", free: true },
  { id: "ganbare", label: "がんばれ", free: true },
  { id: "coffee", label: "コーヒーどうぞ" },
  { id: "fight", label: "ファイト" },
  { id: "nice", label: "いいね" },
  { id: "morning", label: "おはよう" },
  { id: "night", label: "おやすみ" },
  { id: "otsukare", label: "おつかれ" },
  { id: "thanks", label: "ありがとう" },
  { id: "wow", label: "すごい！" },
  { id: "wakaru", label: "わかる〜" },
  { id: "focus", label: "ナイス集中" },
  { id: "pat", label: "よしよし" },
  { id: "dango", label: "休憩しよ" },
  { id: "heart", label: "ハート" },
  { id: "nebare", label: "ねばれ！" },
  { id: "hanamaru", label: "花まる" },
  { id: "congrats", label: "おめでとう" },
  { id: "daruma", label: "合格祈願" },
  { id: "crown", label: "さいこう" },
] as const satisfies readonly { id: string; label: string; free?: boolean }[];

export type StampId = (typeof STAMPS)[number]["id"];
export type Stamp = (typeof STAMPS)[number];

const BY_ID = new Map<string, Stamp>(STAMPS.map((s) => [s.id, s]));

export function isStampId(v: unknown): v is StampId {
  return typeof v === "string" && BY_ID.has(v);
}

export function getStamp(id: string): Stamp | undefined {
  return BY_ID.get(id);
}

export function isFreeStamp(id: string): boolean {
  const s = BY_ID.get(id);
  return Boolean(s && "free" in s && s.free);
}

/** 使えるスタンプ（無料＋買ったもの）を一覧の順で */
export function usableStamps(owned: Iterable<string>): Stamp[] {
  const set = new Set(owned);
  return STAMPS.filter((s) => isFreeStamp(s.id) || set.has(`stamp:${s.id}`));
}
