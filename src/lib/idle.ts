/** 操作がないまま、この時間たったら「まだ勉強中？」と聞く */
export const IDLE_ASK_MS = 30 * 60_000;
/** 操作がないまま、この時間たったらサーバーが退室にする（DB の cleanup_stale_sessions と合わせる） */
export const IDLE_LEAVE_MS = 35 * 60_000;

/** 退室までの残り（ミリ秒、0 未満にはしない） */
export function idleRemainingMs(lastActiveAt: number, now: number): number {
  return Math.max(0, lastActiveAt + IDLE_LEAVE_MS - now);
}

/** 残り時間を「4分30秒」のように */
export function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}分${r > 0 ? `${r}秒` : ""}` : `${r}秒`;
}
