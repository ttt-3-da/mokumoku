import { describe, expect, it } from "vitest";
import { parseStopwatch, startStopwatch, stopStopwatch, stopwatchElapsed, STOPWATCH_ZERO } from "./stopwatch";

describe("stopwatch", () => {
  it("開始 → 停止 → 再開で時間がたまっていく", () => {
    let sw = startStopwatch(STOPWATCH_ZERO, 1_000);
    expect(stopwatchElapsed(sw, 4_000)).toBe(3_000);
    sw = stopStopwatch(sw, 5_000);
    expect(sw).toEqual({ accMs: 4_000, since: null });
    expect(stopwatchElapsed(sw, 99_000)).toBe(4_000); // 止まっている間は増えない
    sw = startStopwatch(sw, 10_000);
    expect(stopwatchElapsed(sw, 12_000)).toBe(6_000);
  });

  it("動いているときに開始、止まっているときに停止しても変わらない", () => {
    const running = { accMs: 0, since: 1_000 };
    expect(startStopwatch(running, 5_000)).toBe(running);
    expect(stopStopwatch(STOPWATCH_ZERO, 5_000)).toBe(STOPWATCH_ZERO);
  });

  it("おかしな値は受け付けない", () => {
    expect(parseStopwatch({ accMs: 10, since: null })).toEqual({ accMs: 10, since: null });
    expect(parseStopwatch({ accMs: -1, since: null })).toBeNull();
    expect(parseStopwatch({ accMs: 1, since: "x" })).toBeNull();
    expect(parseStopwatch(undefined)).toBeNull();
  });
});
