import Link from "next/link";
import { formatMinutes } from "@/lib/pomodoro";
import { GOAL_BONUS, progressPercent, type WeeklyProgress } from "@/lib/goals";

/** 今週の進み具合のバー。目標がなければ、本人には目標を決めるリンクを出す */
export function WeeklyGoalBar({ progress, isMe }: { progress: WeeklyProgress; isMe: boolean }) {
  if (!progress.goal) {
    if (!isMe) return null;
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-3 text-sm text-ink-soft">
        今週 <b className="text-ink">{formatMinutes(progress.minutes)}</b> 勉強しました。
        <Link href="/settings#weekly_goal" className="ml-1 underline">
          週の目標を決める
        </Link>
        と、達成で 🪙{GOAL_BONUS} もらえます。
      </p>
    );
  }
  const pct = progressPercent(progress);
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${progress.achieved ? "border-accent bg-sakura/10" : "border-line bg-paper"}`}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-bold">{progress.achieved ? "🎉 今週の目標を達成！" : "今週の目標"}</span>
        <span className="tabular-nums">
          <b>{formatMinutes(progress.minutes)}</b> / {formatMinutes(progress.goal)}
        </span>
        {isMe && (
          <Link href="/settings#weekly_goal" className="ml-auto text-xs text-ink-soft hover:underline">
            目標を変える
          </Link>
        )}
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-cream"
        role="progressbar"
        aria-label="今週の目標の進み具合"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={`h-full rounded-full ${progress.achieved ? "bg-accent" : "bg-yomogi"}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}
