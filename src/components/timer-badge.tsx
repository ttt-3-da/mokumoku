"use client";

import { computeTimer, formatClock } from "@/lib/pomodoro";
import { useNow } from "@/lib/hooks/use-now";
import type { RoomCard } from "@/lib/types";

type Props = Pick<RoomCard, "timer_mode" | "timer_started_at" | "focus_minutes" | "break_minutes">;

export function TimerBadge({ timer_mode, timer_started_at, focus_minutes, break_minutes }: Props) {
  const now = useNow(1000);

  if (timer_mode === "free") {
    return <Badge className="bg-cream text-ink-soft">🕊️ 自由</Badge>;
  }
  if (now === null) {
    return <Badge className="bg-cream text-ink-soft">🍅 {focus_minutes}/{break_minutes}分</Badge>;
  }

  const t = computeTimer(timer_started_at, focus_minutes, break_minutes, now);
  if (t.kind === "idle") {
    return <Badge className="bg-cream text-ink-soft">🍅 {focus_minutes}/{break_minutes}分・待機中</Badge>;
  }
  return t.kind === "focus" ? (
    <Badge className="bg-sakura/25 text-accent-strong">
      ✏️ 集中 {t.round}R あと{formatClock(t.remainingMs)}
    </Badge>
  ) : (
    <Badge className="bg-yomogi/25 text-green-800">
      🍵 休憩 あと{formatClock(t.remainingMs)}
    </Badge>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs tabular-nums ${className}`}>
      {children}
    </span>
  );
}
