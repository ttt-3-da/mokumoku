/**
 * 自由モードの部屋で使う、自分用のストップウォッチ。
 * 「止めるまでにたまった時間」と「動かし始めた時刻」だけを持ち、表示のたびに経過時間を計算する。
 * Presence で共有するので、ほかの人の画面でも同じ時間が見える（時刻はサーバー基準に補正した値を使う）。
 */
export type Stopwatch = {
  /** 止めた時点までにたまった時間（ミリ秒） */
  accMs: number;
  /** 動いているときは動かし始めた時刻（ミリ秒）、止まっているときは null */
  since: number | null;
};

export const STOPWATCH_ZERO: Stopwatch = { accMs: 0, since: null };

/** サーバー基準に補正した今の時刻（ミリ秒） */
export function clockNow(offsetMs = 0): number {
  return Date.now() + offsetMs;
}

export function stopwatchElapsed(sw: Stopwatch, now: number): number {
  return sw.accMs + (sw.since === null ? 0 : Math.max(0, now - sw.since));
}

export function startStopwatch(sw: Stopwatch, now: number): Stopwatch {
  return sw.since === null ? { accMs: sw.accMs, since: now } : sw;
}

export function stopStopwatch(sw: Stopwatch, now: number): Stopwatch {
  return sw.since === null ? sw : { accMs: stopwatchElapsed(sw, now), since: null };
}

/** Presence や localStorage から来た値を検証する。おかしな値なら null */
export function parseStopwatch(raw: unknown): Stopwatch | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const accOk = typeof v.accMs === "number" && Number.isFinite(v.accMs) && v.accMs >= 0;
  const sinceOk = v.since === null || (typeof v.since === "number" && Number.isFinite(v.since));
  return accOk && sinceOk ? { accMs: v.accMs as number, since: v.since as number | null } : null;
}
