import { describe, expect, it } from "vitest";
import { formatRemaining, IDLE_ASK_MS, IDLE_LEAVE_MS, idleRemainingMs } from "./idle";

describe("idle", () => {
  it("聞いてから退室まで5分ある", () => {
    expect(IDLE_LEAVE_MS - IDLE_ASK_MS).toBe(5 * 60_000);
    expect(idleRemainingMs(0, IDLE_ASK_MS)).toBe(5 * 60_000);
    expect(idleRemainingMs(0, IDLE_LEAVE_MS + 1000)).toBe(0);
  });
  it("残り時間を読みやすくする", () => {
    expect(formatRemaining(270_000)).toBe("4分30秒");
    expect(formatRemaining(240_000)).toBe("4分");
    expect(formatRemaining(9_500)).toBe("10秒");
  });
});
