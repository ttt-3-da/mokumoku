import { describe, expect, it } from "vitest";
import { computeTimer, formatClock, formatMinutes, nextPhaseChange } from "./pomodoro";

const start = "2026-11-12T09:00:00.000Z";
const at = (min: number, sec = 0) => Date.parse(start) + min * 60_000 + sec * 1000;

describe("computeTimer", () => {
  it("開始前は idle", () => {
    expect(computeTimer(null, 25, 5, at(0))).toEqual({ kind: "idle" });
  });

  it("開始直後は1ラウンド目の集中", () => {
    expect(computeTimer(start, 25, 5, at(0))).toMatchObject({
      kind: "focus",
      round: 1,
      completedRounds: 0,
      remainingMs: 25 * 60_000,
      progress: 0,
    });
  });

  it("25分ちょうどで休憩に入り、完了回数が1になる", () => {
    expect(computeTimer(start, 25, 5, at(25))).toMatchObject({
      kind: "break",
      round: 1,
      completedRounds: 1,
      remainingMs: 5 * 60_000,
    });
  });

  it("30分で2ラウンド目の集中", () => {
    expect(computeTimer(start, 25, 5, at(30))).toMatchObject({ kind: "focus", round: 2, completedRounds: 1 });
  });

  it("途中入室（67分12秒後）でも同じ値になる", () => {
    // 67:12 = 2サイクル(60分) + 7:12 → 3ラウンド目の集中、残り 17:48
    const t = computeTimer(start, 25, 5, at(67, 12));
    expect(t).toMatchObject({ kind: "focus", round: 3, completedRounds: 2 });
    if (t.kind !== "idle") expect(formatClock(t.remainingMs)).toBe("17:48");
  });

  it("サーバーより時計が遅れていて開始前に見えても、0として扱う", () => {
    expect(computeTimer(start, 25, 5, at(-1))).toMatchObject({ kind: "focus", progress: 0 });
  });
});

describe("format", () => {
  it("formatClock", () => {
    expect(formatClock(125_000)).toBe("2:05");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(1)).toBe("0:01"); // 端数は切り上げ（0:00 表示のまま待たせない）
  });
  it("formatMinutes", () => {
    expect(formatMinutes(40)).toBe("40分");
    expect(formatMinutes(60)).toBe("1時間");
    expect(formatMinutes(95)).toBe("1時間35分");
  });
});

describe("nextPhaseChange", () => {
  it("タイマーが動いていなければ null", () => {
    expect(nextPhaseChange(null, 25, 5, at(0))).toBeNull();
  });
  it("集中中は、休憩が始まるまでの時間を返す", () => {
    expect(nextPhaseChange(start, 25, 5, at(20))).toEqual({ inMs: 5 * 60_000, next: "break" });
  });
  it("休憩中は、休憩が終わるまでの時間を返す", () => {
    expect(nextPhaseChange(start, 25, 5, at(27, 30))).toEqual({ inMs: 2.5 * 60_000, next: "focus" });
  });
});