import { describe, expect, it } from "vitest";
import { groupLogByDay } from "./log";
import type { LogEntry } from "./types";

const entry = (id: string, started: string, ended: string, minutes: number): LogEntry => ({
  id,
  started_at: started,
  ended_at: ended,
  minutes,
  pomodoros: 0,
  task: "英単語",
  note: "",
  room_id: "r",
  room_name: "部屋",
  room_icon: "📚",
});

describe("groupLogByDay", () => {
  it("日本時間の日付ごとにまとめて、合計を出す", () => {
    const days = groupLogByDay([
      entry("a", "2026-11-12T05:00:00Z", "2026-11-12T06:30:00Z", 90), // 12日 14:00〜15:30
      entry("b", "2026-11-12T00:00:00Z", "2026-11-12T00:30:00Z", 30), // 12日 9:00〜9:30
      entry("c", "2026-11-11T16:00:00Z", "2026-11-11T17:00:00Z", 60), // 12日 1:00（日本時間では12日）
      entry("d", "2026-11-11T14:00:00Z", "2026-11-11T14:45:00Z", 45), // 11日 23:00
    ]);
    expect(days.map((d) => [d.label, d.totalMinutes])).toEqual([
      ["11月12日（木）", 180],
      ["11月11日（水）", 45],
    ]);
    expect(days[0].entries[0].timeRange).toBe("14:00〜15:30");
    expect(days[1].entries[0].timeRange).toBe("23:00〜23:45");
  });
});
