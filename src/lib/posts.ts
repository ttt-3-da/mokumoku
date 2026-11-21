import type { Avatar } from "@/lib/avatar";
import { getStamp, type StampId } from "@/lib/stamps";

/** 投稿に送れるのは、だれでも使えるこの4つのもちスタンプだけ（DB の post_reactions と一致させる） */
export const POST_STAMPS = ["clap", "ganbare", "otsukare", "wow"] as const satisfies readonly StampId[];
export type PostStampId = (typeof POST_STAMPS)[number];

export function isPostStamp(v: unknown): v is PostStampId {
  return typeof v === "string" && (POST_STAMPS as readonly string[]).includes(v);
}

export function postStampLabel(id: PostStampId): string {
  return getStamp(id)?.label ?? id;
}

export type PostReaction = { stamp_id: PostStampId; count: number; reacted: boolean };

export type Post = {
  id: string;
  body: string;
  created_at: string;
  todos_done: number;
  minutes: number;
  task: string;
  pomodoros: number;
  room_name: string | null;
  room_icon: string | null;
  username: string;
  display_name: string;
  avatar: Avatar;
  mine: boolean;
  reactions: PostReaction[];
  /** 運営が「確認しました」の印をつけた */
  staff_checked: boolean;
};

export type FeedTab = "following" | "all";

export function parseFeedTab(v: unknown): FeedTab {
  return v === "all" ? "all" : "following";
}

/** 押した／取り消したあとのリアクションの数（画面をすぐ変えるため） */
export function toggleReaction(list: PostReaction[], id: PostStampId, on: boolean): PostReaction[] {
  const found = list.find((r) => r.stamp_id === id);
  if (!found) return on ? [...list, { stamp_id: id, count: 1, reacted: true }] : list;
  return list
    .map((r) => (r.stamp_id === id ? { ...r, count: Math.max(0, r.count + (on ? 1 : -1)), reacted: on } : r))
    .filter((r) => r.count > 0);
}
