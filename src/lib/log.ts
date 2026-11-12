import type { LogEntry } from "@/lib/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 日本時間での日付・時刻の部品 */
function jstParts(iso: string) {
  const d = new Date(Date.parse(iso) + 9 * 60 * 60_000);
  return {
    date: d.toISOString().slice(0, 10),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: WEEKDAYS[d.getUTCDay()],
    time: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
  };
}

export type LogDay = {
  date: string;
  /** 「11月12日（木）」 */
  label: string;
  totalMinutes: number;
  entries: (LogEntry & { timeRange: string })[];
};

/** 記録を日本時間の「入室した日」ごとにまとめる（新しい順のまま） */
export function groupLogByDay(entries: LogEntry[]): LogDay[] {
  const days: LogDay[] = [];
  for (const e of entries) {
    const start = jstParts(e.started_at);
    const end = jstParts(e.ended_at);
    let day = days.at(-1);
    if (!day || day.date !== start.date) {
      day = { date: start.date, label: `${start.month}月${start.day}日（${start.weekday}）`, totalMinutes: 0, entries: [] };
      days.push(day);
    }
    day.totalMinutes += e.minutes;
    day.entries.push({ ...e, timeRange: `${start.time}〜${end.time}` });
  }
  return days;
}
