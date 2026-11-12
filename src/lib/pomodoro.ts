/**
 * ポモドーロの状態計算。
 * 各クライアントでカウントダウンせず、rooms.timer_started_at だけを基準に
 * 「今どのフェーズで残り何秒か」を毎回計算する。途中入室者ともズレない。
 */
export type TimerState =
  | { kind: "idle" }
  | {
      kind: "focus" | "break";
      /** 今何ラウンド目か（1始まり） */
      round: number;
      /** 完了した集中フェーズの回数 */
      completedRounds: number;
      remainingMs: number;
      phaseMs: number;
      /** 0〜1 */
      progress: number;
    };

const MINUTE = 60_000;

export function computeTimer(
  startedAt: string | null,
  focusMinutes: number,
  breakMinutes: number,
  nowMs: number,
): TimerState {
  if (!startedAt) return { kind: "idle" };
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return { kind: "idle" };

  const focusMs = focusMinutes * MINUTE;
  const breakMs = breakMinutes * MINUTE;
  const cycleMs = focusMs + breakMs;
  const elapsed = Math.max(0, nowMs - start);

  const cycles = Math.floor(elapsed / cycleMs);
  const within = elapsed - cycles * cycleMs;
  const inFocus = within < focusMs;
  const phaseMs = inFocus ? focusMs : breakMs;
  const phaseElapsed = inFocus ? within : within - focusMs;

  return {
    kind: inFocus ? "focus" : "break",
    round: cycles + 1,
    completedRounds: cycles + (inFocus ? 0 : 1),
    remainingMs: phaseMs - phaseElapsed,
    phaseMs,
    progress: phaseElapsed / phaseMs,
  };
}

/** 125000 → "2:05"、3725000 → "1:02:05" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 95 → "1時間35分"、40 → "40分" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
