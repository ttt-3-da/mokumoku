import type { TimerMode } from "@/lib/types";
import { isStampId, type StampId } from "@/lib/stamps";
import type { TimerState } from "@/lib/pomodoro";

// ---------------------------------------------------------------- スタンプ

/** スタンプはクライアント側で2秒に1回まで */
export const STAMP_INTERVAL_MS = 2000;

export type StampEvent = { id: string; from: string; to: string; stamp: StampId };

/**
 * スタンプを送れるか。
 * - 自由モードはいつでも
 * - ポモドーロモードは休憩中だけ（タイマーが始まる前は、まだ誰も集中していないので送れる）
 */
export function stampsAllowed(mode: TimerMode, timer: TimerState): boolean {
  if (mode === "free") return true;
  return timer.kind !== "focus";
}

/** 前回の送信から2秒経っていれば送れる。経っていなければ待つ残りミリ秒を返す */
export function stampCooldown(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, STAMP_INTERVAL_MS - (now - lastSentAt));
}

/** 送ってよければ送信時刻を記録して true（2秒以内の連打は false） */
export function claimStampSlot(last: { current: number | null }, now = Date.now()): boolean {
  if (stampCooldown(last.current, now) > 0) return false;
  last.current = now;
  return true;
}

/** Broadcast で受け取った値がスタンプとして正しい形か */
export function parseStampEvent(raw: unknown): StampEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    typeof v.from !== "string" ||
    typeof v.to !== "string" ||
    v.from === v.to ||
    !isStampId(v.stamp)
  ) {
    return null;
  }
  return { id: v.id, from: v.from, to: v.to, stamp: v.stamp };
}

// ---------------------------------------------------------------- 席

/** 机は横並びで1列 SEATS_PER_ROW 人。人数が増えたら2列目へ */
export const SEATS_PER_ROW = 5;

export function toRows<T>(items: T[], perRow = SEATS_PER_ROW): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

/**
 * 隣どうしに座っている「仲良し」（同じ部屋で累計10時間以上一緒にいた）ペアを返す。
 * companions は [userA, userB] の組（順不同）。
 */
export function neighborCompanions(
  userIds: string[],
  companions: [string, string][],
  perRow = SEATS_PER_ROW,
): [string, string][] {
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const set = new Set(companions.map(([a, b]) => key(a, b)));
  const result: [string, string][] = [];
  for (const row of toRows(userIds, perRow)) {
    for (let i = 0; i + 1 < row.length; i++) {
      if (set.has(key(row[i], row[i + 1]))) result.push([row[i], row[i + 1]]);
    }
  }
  return result;
}

// ---------------------------------------------------------------- 時計

/**
 * サーバー時刻との差（ミリ秒）。送信時刻 t0 と受信時刻 t1 の真ん中でサーバーが時刻を
 * 読んだとみなす。複数回測ったときは往復時間が一番短いものを使う。
 */
export function clockOffset(samples: { t0: number; t1: number; server: number }[]): number {
  if (samples.length === 0) return 0;
  const best = samples.reduce((a, b) => (b.t1 - b.t0 < a.t1 - a.t0 ? b : a));
  return Math.round(best.server - (best.t0 + best.t1) / 2);
}

// ---------------------------------------------------------------- ポモドーロ完了

/** 休憩に入ってからこの時間は「ポモドーロ完了」の演出をする */
export const CELEBRATE_MS = 3000;

/**
 * 今ポモドーロ完了の演出をするか。状態を持たず、タイマーの値だけから決める
 * （全員が同じ timer_started_at から計算するので、部屋の全員が同時に跳ねる）。
 */
export function isCelebrating(timer: TimerState): boolean {
  return timer.kind === "break" && timer.phaseMs - timer.remainingMs < CELEBRATE_MS;
}

/**
 * 連続集中の分数（もちの湯気・赤いほっぺ用）。
 * ポモドーロ中は今の集中フェーズの経過分、それ以外は入室からの経過分。
 */
export function continuousFocusMinutes(timer: TimerState, joinedAtMs: number, nowMs: number): number {
  if (timer.kind === "focus") {
    return Math.min((timer.phaseMs - timer.remainingMs) / 60_000, (nowMs - joinedAtMs) / 60_000);
  }
  if (timer.kind === "break") return 0;
  return Math.max(0, (nowMs - joinedAtMs) / 60_000);
}