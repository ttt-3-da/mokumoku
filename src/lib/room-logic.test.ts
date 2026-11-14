import { describe, expect, it } from "vitest";
import {
  clockOffset,
  continuousFocusMinutes,
  isCelebrating,
  neighborCompanions,
  parseStampEvent,
  stampCooldown,
  stampsAllowed,
  toRows,
} from "./room-logic";

describe("stampsAllowed", () => {
  const focus = { kind: "focus", round: 1, completedRounds: 0, remainingMs: 1, phaseMs: 2, progress: 0.5 } as const;
  const brk = { ...focus, kind: "break" } as const;
  it("自由モードはいつでも送れる", () => {
    expect(stampsAllowed("free", focus)).toBe(true);
  });
  it("ポモドーロは集中中だけ送れない（開始前と休憩中は送れる）", () => {
    expect(stampsAllowed("pomodoro", focus)).toBe(false);
    expect(stampsAllowed("pomodoro", brk)).toBe(true);
    expect(stampsAllowed("pomodoro", { kind: "idle" })).toBe(true);
  });
});

describe("stampCooldown", () => {
  it("2秒に1回まで", () => {
    expect(stampCooldown(null, 1000)).toBe(0);
    expect(stampCooldown(1000, 2500)).toBe(500);
    expect(stampCooldown(1000, 3000)).toBe(0);
  });
});

describe("parseStampEvent", () => {
  it("正しい形だけ受け付ける", () => {
    expect(parseStampEvent({ id: "1", from: "a", to: "b", stamp: "clap" })).toEqual({ id: "1", from: "a", to: "b", stamp: "clap" });
    expect(parseStampEvent({ id: "1", from: "a", to: "b", stamp: "poop" })).toBeNull();
    expect(parseStampEvent({ id: "1", from: "a", to: "b", emoji: "👏" })).toBeNull();
    expect(parseStampEvent({ id: "1", from: "a", to: "a", stamp: "clap" })).toBeNull();
    expect(parseStampEvent(null)).toBeNull();
  });
});

describe("toRows / neighborCompanions", () => {
  it("5人ごとに列を分ける", () => {
    expect(toRows([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
  });
  it("同じ列で隣どうしの仲良しペアだけ返す", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const companions: [string, string][] = [
      ["b", "a"], // 隣
      ["a", "c"], // 隣ではない
      ["e", "f"], // 列が違う（e は1列目の端、f は2列目）
    ];
    expect(neighborCompanions(ids, companions)).toEqual([["a", "b"]]);
  });
});

describe("clockOffset", () => {
  it("往復時間が一番短い測定を使い、真ん中の時刻との差を返す", () => {
    expect(
      clockOffset([
        { t0: 1000, t1: 1400, server: 5000 }, // 往復400ms
        { t0: 2000, t1: 2100, server: 6050 }, // 往復100ms → 6050 - 2050
      ]),
    ).toBe(4000);
    expect(clockOffset([])).toBe(0);
  });
});

describe("isCelebrating", () => {
  const base = { round: 1, completedRounds: 1, phaseMs: 300_000, progress: 0 } as const;
  it("休憩に入って3秒間だけ true", () => {
    expect(isCelebrating({ ...base, kind: "break", remainingMs: 299_000 })).toBe(true);
    expect(isCelebrating({ ...base, kind: "break", remainingMs: 290_000 })).toBe(false);
    expect(isCelebrating({ ...base, kind: "focus", remainingMs: 299_000 })).toBe(false);
    expect(isCelebrating({ kind: "idle" })).toBe(false);
  });
});

describe("continuousFocusMinutes", () => {
  const now = 10 * 60 * 60_000;
  it("ポモドーロの集中中はフェーズの経過分、休憩中は0", () => {
    const focus = { kind: "focus", round: 2, completedRounds: 1, phaseMs: 50 * 60_000, remainingMs: 20 * 60_000, progress: 0.6 } as const;
    expect(continuousFocusMinutes(focus, 0, now)).toBe(30);
    expect(continuousFocusMinutes({ ...focus, kind: "break" }, 0, now)).toBe(0);
  });
  it("タイマーなしなら入室からの経過分", () => {
    expect(continuousFocusMinutes({ kind: "idle" }, now - 90 * 60_000, now)).toBe(90);
  });
});