import { describe, expect, it } from "vitest";
import { parseGoalHours, progressPercent } from "./goals";
import { buildInsights, canGoBack, jstDate, periodLabel, periodRange, periodStart, weekStart, type StudyRow } from "./study-insights";

const row = (start: string, minutes: number, extra: Partial<StudyRow> = {}): StudyRow => ({
  started_at: start,
  ended_at: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
  minutes,
  pomodoros: 0,
  room_name: "図書館",
  room_icon: "📚",
  tags: [],
  ...extra,
});

describe("日付", () => {
  it("日本時間の日付と月曜", () => {
    expect(jstDate("2026-11-13T15:30:00Z")).toBe("2026-11-14");
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // 日曜 → その週の月曜
    expect(periodStart("month", "2026-11-14")).toBe("2026-11-01");
    expect(periodStart("year", "2026-11-14")).toBe("2025-12-01");
  });
});

describe("buildInsights", () => {
  const now = new Date("2026-11-14T12:00:00Z"); // 土曜 21時（日本時間）
  const rows = [
    row("2026-11-09T22:30:00Z", 60, { tags: ["英語"], pomodoros: 2 }), // 火曜 7:30〜8:30
    row("2026-11-13T12:00:00Z", 30, { tags: ["英語", "数学"], room_name: "カフェ", room_icon: "☕" }), // 金曜 21:00
    row("2026-10-01T00:00:00Z", 999), // 期間外
  ];

  it("今週は日ごとの棒が7本、合計と平均", () => {
    const r = buildInsights(rows, "week", now);
    expect(r.bars).toHaveLength(7);
    expect(r.bars[1].minutes).toBe(60);
    expect(r.bars[4].minutes).toBe(30);
    expect(r.total).toBe(90);
    expect(r.averageSession).toBe(45);
    expect(r.pomodoros).toBe(2);
  });

  it("時間帯は実際にまたいだ時間に分けて足す", () => {
    const r = buildInsights(rows, "week", now);
    expect(r.hours[7]).toBe(30);
    expect(r.hours[8]).toBe(30);
    expect(r.hours[21]).toBe(30);
    expect(r.chronotype).toBe("morning");
  });

  it("タグと部屋は多い順", () => {
    const r = buildInsights(rows, "week", now);
    expect(r.tags[0]).toEqual({ name: "英語", minutes: 90 });
    expect(r.rooms.map((x) => x.name)).toEqual(["図書館", "カフェ"]);
  });

  it("1年は月ごと、3か月は週ごと", () => {
    expect(buildInsights(rows, "year", now).bars).toHaveLength(12);
    expect(buildInsights(rows, "year", now).bars[10].minutes).toBe(999);
    expect(buildInsights(rows, "3months", now).barUnit).toBe("week");
  });
});

describe("週の目標", () => {
  it("時間を分にする（0.5刻み）", () => {
    expect(parseGoalHours("")).toEqual({ ok: true, value: null });
    expect(parseGoalHours("10")).toEqual({ ok: true, value: 600 });
    expect(parseGoalHours("3.5")).toEqual({ ok: true, value: 210 });
    expect(parseGoalHours("2").ok).toBe(false);
    expect(parseGoalHours("abc").ok).toBe(false);
  });
  it("進み具合は100%まで", () => {
    expect(progressPercent({ goal: 600, minutes: 300, achieved: false })).toBe(50);
    expect(progressPercent({ goal: 600, minutes: 900, achieved: true })).toBe(100);
  });
});

describe("前の期間", () => {
  const now = new Date("2026-11-14T12:00:00Z"); // 土曜（日本時間）
  const rows = [
    row("2026-11-03T00:00:00Z", 40), // 先週の火曜
    row("2026-10-20T00:00:00Z", 25), // 先月
    row("2026-11-10T00:00:00Z", 10), // 今週
  ];

  it("先週・先月の範囲と見出し", () => {
    expect(periodRange("week", "2026-11-14", -1)).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(periodRange("month", "2026-11-14", -1)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(periodRange("month", "2026-01-14", -1)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(periodLabel("week", now, -1)).toBe("先週");
    expect(periodLabel("week", now, -2)).toBe("10月26日〜11月1日");
    expect(periodLabel("month", now, -1)).toBe("先月");
    expect(periodLabel("month", now, -11)).toBe("2025年12月");
  });

  it("先週は先週のぶんだけ数え、棒は7本", () => {
    const r = buildInsights(rows, "week", now, -1);
    expect(r.bars).toHaveLength(7);
    expect(r.total).toBe(40);
    expect(r.bars[1].minutes).toBe(40);
  });

  it("先月は月末まで日ごとの棒を出す", () => {
    const r = buildInsights(rows, "month", now, -1);
    expect(r.bars).toHaveLength(31);
    expect(r.total).toBe(25);
  });

  it("約400日より前にはさかのぼれない", () => {
    expect(canGoBack("week", now, 0)).toBe(true);
    expect(canGoBack("year", now, 0)).toBe(true);
    expect(canGoBack("year", now, -1)).toBe(false);
  });
});
