import { parseAvatar } from "@/lib/avatar";
import { parseStopwatch } from "@/lib/stopwatch";
import type { PresenceMeta, PresenceStatus } from "@/lib/types";

/**
 * Supabase の presenceState() は { [key]: meta[] } の形。
 * key はユーザーIDにしているが、同じユーザーが複数タブで開くと meta が複数並ぶ。
 * → 各ユーザーについて updatedAt が最新の meta だけを採用し、入室順に並べる。
 */
export function flattenPresence(state: Record<string, unknown[]>): PresenceMeta[] {
  const latest = new Map<string, PresenceMeta>();
  for (const metas of Object.values(state)) {
    for (const raw of metas) {
      if (!isPresenceMeta(raw)) continue;
      const prev = latest.get(raw.userId);
      // アバターは壊れていてもデフォルトで表示する
      if (!prev || raw.updatedAt > prev.updatedAt) {
        latest.set(raw.userId, {
          ...raw,
          avatar: parseAvatar(raw.avatar),
          stopwatch: parseStopwatch(raw.stopwatch),
          plantLevel: raw.plantLevel === 2 || raw.plantLevel === 3 ? raw.plantLevel : 1,
        });
      }
    }
  }
  return [...latest.values()].sort(
    (a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt) || a.userId.localeCompare(b.userId),
  );
}

const STATUSES: PresenceStatus[] = ["focus", "break", "away"];

function isPresenceMeta(v: unknown): v is PresenceMeta {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.userId === "string" &&
    typeof m.displayName === "string" &&
    typeof m.task === "string" &&
    typeof m.joinedAt === "string" &&
    typeof m.updatedAt === "number" &&
    STATUSES.includes(m.status as PresenceStatus)
  );
}

/**
 * 表示する状態を決める。
 * - タブが非表示なら「離席中」
 * - ポモドーロの休憩中なら「休憩中」、それ以外は「集中中」
 */
export function resolveStatus({
  hidden,
  timerPhase,
}: {
  hidden: boolean;
  timerPhase: "focus" | "break" | "idle";
}): PresenceStatus {
  if (hidden) return "away";
  return timerPhase === "break" ? "break" : "focus";
}

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  focus: "集中中",
  break: "休憩中",
  away: "離席中",
};
