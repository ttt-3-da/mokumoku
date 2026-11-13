/**
 * 「記録」ページのふり返りグラフ用の集計。
 * DB からは期間内の自分のセッション（list_my_study_stats）をそのまま受け取り、ここでまとめる。
 * 日付は日本時間、週は月曜始まり。セッションは入室した日に数える（DB の集計と同じ）
 */
import { addDays } from "./stats";

export type StudyRow = {
  started_at: string;
  ended_at: string;
  minutes: number;
  pomodoros: number;
  room_name: string;
  room_icon: string;
  tags: string[];
};

export type InsightPeriod = "week" | "month" | "3months" | "year";

export const INSIGHT_PERIODS: Record<InsightPeriod, string> = {
  week: "今週",
  month: "今月",
  "3months": "3か月",
  year: "1年",
};

export function parseInsightPeriod(v: unknown): InsightPeriod {
  return v === "month" || v === "3months" || v === "year" ? v : "week";
}

const JST_OFFSET = 9 * 60 * 60 * 1000; // 日本は夏時間がない

/** 日本時間の日付 "YYYY-MM-DD" */
export function jstDate(t: Date | string): string {
  return new Date(new Date(t).getTime() + JST_OFFSET).toISOString().slice(0, 10);
}

/** その日を含む週の月曜 */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=日
  return addDays(date, -((dow + 6) % 7));
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function addMonths(date: string, n: number): string {
  const d = new Date(`${monthStart(date)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** 期間の最初の日（日本時間の日付） */
export function periodStart(period: InsightPeriod, today: string): string {
  switch (period) {
    case "week":
      return weekStart(today);
    case "month":
      return monthStart(today);
    case "3months":
      return weekStart(addDays(today, -7 * 12));
    case "year":
      return addMonths(today, -11);
  }
}

/** 期間の最初の時刻（DB に渡す） */
export function periodStartIso(period: InsightPeriod, now: Date): string {
  return new Date(Date.parse(`${periodStart(period, jstDate(now))}T00:00:00Z`) - JST_OFFSET).toISOString();
}

export type Bar = { key: string; label: string; minutes: number };

export type Insights = {
  total: number;
  sessions: number;
  pomodoros: number;
  averageSession: number;
  /** 期間に合わせた棒（今週・今月は日ごと、3か月は週ごと、1年は月ごと） */
  bars: Bar[];
  barUnit: "day" | "week" | "month";
  /** 0〜23時に集中していた分数 */
  hours: number[];
  /** 月〜日の1日あたり平均（分） */
  weekdayAverage: number[];
  tags: { name: string; minutes: number }[];
  rooms: { name: string; icon: string; minutes: number }[];
  /** 朝型・夜型 */
  chronotype: "morning" | "daytime" | "night" | null;
};

function top<T extends { minutes: number }>(m: Map<string, T>, n: number): T[] {
  return [...m.values()].sort((a, b) => b.minutes - a.minutes).slice(0, n);
}

export function buildInsights(rows: StudyRow[], period: InsightPeriod, now: Date): Insights {
  const today = jstDate(now);
  const start = periodStart(period, today);
  const inRange = rows.filter((r) => {
    const d = jstDate(r.started_at);
    return d >= start && d <= today;
  });

  // 棒グラフ
  const barUnit = period === "3months" ? "week" : period === "year" ? "month" : "day";
  const bars: Bar[] = [];
  const index = new Map<string, Bar>();
  const end = period === "week" ? addDays(start, 6) : today;
  if (barUnit === "day") {
    for (let d = start; d <= end; d = addDays(d, 1)) bars.push({ key: d, label: String(Number(d.slice(8))), minutes: 0 });
  } else if (barUnit === "week") {
    for (let d = start; d <= today; d = addDays(d, 7)) bars.push({ key: d, label: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`, minutes: 0 });
  } else {
    for (let d = start; d <= today; d = addMonths(d, 1)) bars.push({ key: d.slice(0, 7), label: `${Number(d.slice(5, 7))}月`, minutes: 0 });
  }
  for (const b of bars) index.set(b.key, b);

  const hours = Array.from({ length: 24 }, () => 0);
  const weekdayTotal = Array.from({ length: 7 }, () => 0);
  const tags = new Map<string, { name: string; minutes: number }>();
  const rooms = new Map<string, { name: string; icon: string; minutes: number }>();
  let total = 0;
  let pomodoros = 0;

  for (const r of inRange) {
    const d = jstDate(r.started_at);
    const key = barUnit === "day" ? d : barUnit === "week" ? weekStart(d) : d.slice(0, 7);
    const bar = index.get(key);
    if (bar) bar.minutes += r.minutes;
    total += r.minutes;
    pomodoros += r.pomodoros;
    weekdayTotal[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7] += r.minutes;

    // 時間帯：勉強していた時間を、実際にまたいだ時間帯へ分けて足す
    let t = Date.parse(r.started_at);
    const stop = Math.min(Date.parse(r.ended_at), t + r.minutes * 60_000);
    while (t < stop) {
      const jst = new Date(t + JST_OFFSET);
      const nextHour = t + (60 - jst.getUTCMinutes()) * 60_000 - jst.getUTCSeconds() * 1000 - jst.getUTCMilliseconds();
      const until = Math.min(stop, nextHour);
      hours[jst.getUTCHours()] += (until - t) / 60_000;
      t = until;
    }

    for (const tag of r.tags) {
      const e = tags.get(tag) ?? { name: tag, minutes: 0 };
      e.minutes += r.minutes;
      tags.set(tag, e);
    }
    const roomKey = `${r.room_icon} ${r.room_name}`;
    const e = rooms.get(roomKey) ?? { name: r.room_name, icon: r.room_icon, minutes: 0 };
    e.minutes += r.minutes;
    rooms.set(roomKey, e);
  }

  // 曜日ごとの平均：期間のうち今日までに、その曜日が何回あったかで割る
  const weekdayCount = Array.from({ length: 7 }, () => 0);
  for (let d = start; d <= today; d = addDays(d, 1)) weekdayCount[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7] += 1;
  const weekdayAverage = weekdayTotal.map((m, i) => (weekdayCount[i] ? Math.round(m / weekdayCount[i]) : 0));

  const roundedHours = hours.map((h) => Math.round(h));
  const morning = roundedHours.slice(4, 11).reduce((a, b) => a + b, 0);
  const daytime = roundedHours.slice(11, 18).reduce((a, b) => a + b, 0);
  const night = [...roundedHours.slice(18), ...roundedHours.slice(0, 4)].reduce((a, b) => a + b, 0);
  const best = Math.max(morning, daytime, night);

  return {
    total,
    sessions: inRange.length,
    pomodoros,
    averageSession: inRange.length ? Math.round(total / inRange.length) : 0,
    bars,
    barUnit,
    hours: roundedHours,
    weekdayAverage,
    tags: top(tags, 8),
    rooms: top(rooms, 8),
    chronotype: best === 0 ? null : best === morning ? "morning" : best === night ? "night" : "daytime",
  };
}

export const CHRONOTYPE_LABEL = {
  morning: "🌅 朝型（4〜11時に多い）",
  daytime: "☀️ 昼型（11〜18時に多い）",
  night: "🌙 夜型（18〜4時に多い）",
} as const;
