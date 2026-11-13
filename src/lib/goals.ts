/** 週の目標。DB の profiles.weekly_goal_minutes（180〜6000分）と合わせる */
export const GOAL_HOURS_MIN = 3;
export const GOAL_HOURS_MAX = 100;
export const GOAL_BONUS = 20;

export type WeeklyProgress = { goal: number | null; minutes: number; achieved: boolean };

/** 入力（時間・0.5刻み）を分にする。空なら目標なし（null） */
export function parseGoalHours(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const h = Number(t);
  if (!Number.isFinite(h) || h < GOAL_HOURS_MIN || h > GOAL_HOURS_MAX) {
    return { ok: false, error: `目標は${GOAL_HOURS_MIN}〜${GOAL_HOURS_MAX}時間で決めてください` };
  }
  return { ok: true, value: Math.round(h * 2) * 30 };
}

export function parseWeeklyProgress(v: unknown): WeeklyProgress | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    goal: typeof o.goal === "number" ? o.goal : null,
    minutes: typeof o.minutes === "number" ? o.minutes : 0,
    achieved: o.achieved === true,
  };
}

/** 進捗バーの割合（0〜100） */
export function progressPercent(p: WeeklyProgress): number {
  if (!p.goal) return 0;
  return Math.min(100, Math.round((p.minutes / p.goal) * 100));
}

export type LastWeekSummary = {
  weekStart: string;
  total: number;
  prevTotal: number;
  bestDay: { date: string; minutes: number } | null;
  tags: string[];
};

export function parseLastWeekSummary(v: unknown): LastWeekSummary | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const best = o.best_day as { date?: unknown; minutes?: unknown } | null;
  return {
    weekStart: String(o.week_start ?? ""),
    total: Number(o.total) || 0,
    prevTotal: Number(o.prev_total) || 0,
    bestDay: best && typeof best.date === "string" ? { date: best.date, minutes: Number(best.minutes) || 0 } : null,
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
  };
}

/** 日本時間で今日が月曜か */
export function isMondayInJapan(now: Date): boolean {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(now) === "Mon";
}
