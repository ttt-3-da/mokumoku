/** get_profile_stats の戻り値と、表示用の計算 */
export type ProfileStats = {
  total_minutes: number;
  total_sessions: number;
  total_pomodoros: number;
  week_minutes: number;
  streak_days: number;
  today: string;
  week_start: string;
  week: { date: string; minutes: number }[];
  calendar_start: string;
  calendar: Record<string, number>;
  tags: { tag: string; minutes: number }[];
};

/** "2026-11-12" に日数を足す（タイムゾーンの影響を受けないよう UTC で計算） */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 草カレンダーの濃さ（0〜4） */
export function grassLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

/**
 * 草カレンダーを「週（列）× 曜日（行、月曜始まり）」に並べる。
 * start は月曜日。今日より後の日は null（マスを描かない）。
 */
export function grassWeeks(
  start: string,
  today: string,
  calendar: Record<string, number>,
  weeks = 26,
): ({ date: string; minutes: number } | null)[][] {
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return date > today ? null : { date, minutes: calendar[date] ?? 0 };
    }),
  );
}

export const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** "2026-11-12" → "11/12" */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}
