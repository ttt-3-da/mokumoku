import type { Avatar } from "@/lib/avatar";
import type { RoomTheme } from "@/lib/room-theme";
import type { Stopwatch } from "@/lib/stopwatch";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
};

export type Visibility = "public" | "unlisted" | "approval";
export type TimerMode = "pomodoro" | "free";

export type Room = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  visibility: Visibility;
  capacity: number;
  timer_mode: TimerMode;
  focus_minutes: number;
  break_minutes: number;
  timer_started_at: string | null;
  is_persistent: boolean;
  invite_code: string;
  theme: RoomTheme;
  created_at: string;
  closed_at: string | null;
};

/** ロビーのカード表示用（在室人数付き） */
export type RoomCard = Pick<
  Room,
  | "id"
  | "name"
  | "icon"
  | "tags"
  | "visibility"
  | "capacity"
  | "timer_mode"
  | "focus_minutes"
  | "break_minutes"
  | "timer_started_at"
  | "is_persistent"
> & { active_count: number };

export type Occupant = {
  user_id: string;
  display_name: string;
  started_at: string;
  avatar: Avatar;
};

/** 入室前画面用（get_room_preview の戻り値） */
export type RoomPreview = {
  room: RoomCard & { description: string; owner_id: string; closed_at: string | null };
  occupants: Occupant[];
  is_member: boolean;
  is_pending: boolean;
  is_staff: boolean;
  is_banned: boolean;
  /** スタッフにだけ返る */
  invite_code: string | null;
  pending_count: number | null;
};

export type StudySession = {
  id: string;
  room_id: string;
  user_id: string;
  task: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  pomodoros: number;
  /** 自分だけのメモ */
  note: string;
};

export type PresenceStatus = "focus" | "break" | "away";

/** Presence で共有する情報 */
export type PresenceMeta = {
  userId: string;
  displayName: string;
  task: string;
  status: PresenceStatus;
  joinedAt: string;
  avatar: Avatar;
  /** 自由モードの自分用ストップウォッチ（使っていなければ null） */
  stopwatch: Stopwatch | null;
  /** 観葉植物の育ち具合（1〜3） */
  plantLevel: 1 | 2 | 3;
  /** 複数タブのうち最新を採用するための更新時刻（ミリ秒） */
  updatedAt: number;
};

export const REACTION_EMOJIS = ["👏", "🔥", "☕", "💪"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** list_my_sessions の1行（自分だけの学習記録） */
export type LogEntry = {
  id: string;
  started_at: string;
  ended_at: string;
  minutes: number;
  pomodoros: number;
  task: string;
  note: string;
  room_id: string;
  room_name: string;
  room_icon: string;
};