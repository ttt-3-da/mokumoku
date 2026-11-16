import type { Avatar } from "@/lib/avatar";

/** get_follow_info の戻り値 */
export type FollowInfo = { followers: number; following: number; is_following: boolean; follows_me: boolean; blocking?: boolean; blocked_by?: boolean };

/** list_follows・search_users などの1行 */
export type UserRow = { username: string; display_name: string; bio: string; avatar: Avatar; is_following?: boolean };

/** list_following_activity の1行。限定・承認制の部屋にいるときは room_* と task が null */
export type FollowingActivity = {
  username: string;
  display_name: string;
  avatar: Avatar;
  started_at: string;
  room_id: string | null;
  room_name: string | null;
  room_icon: string | null;
  task: string | null;
};

/** follow_leaderboard の1行 */
export type LeaderRow = { username: string; display_name: string; avatar: Avatar; week_minutes: number; is_me: boolean };

/** list_notifications の1行 */
export type NotificationRow = {
  id: string;
  kind: "follow" | "badge" | "schedule" | "mochi_stamp" | "post_reaction";
  created_at: string;
  read_at: string | null;
  /** フォロー・もちの部屋のスタンプのお知らせだけ入る */
  actor_username: string | null;
  actor_display_name: string | null;
  actor_avatar: Avatar | null;
  is_following: boolean;
  /** 定例の部屋のお知らせだけ入る */
  room_id: string | null;
  room_name: string | null;
  room_icon: string | null;
  /** バッジの ID・スタンプの ID */
  detail: string | null;
};

/** ランキングのバーの長さ（いちばん多い人を100%、0分でも見えるよう最低2%） */
export function barPercent(minutes: number, max: number): number {
  if (max <= 0) return 2;
  return Math.max(2, Math.round((minutes / max) * 100));
}
