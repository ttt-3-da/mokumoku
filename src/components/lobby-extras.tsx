import Link from "next/link";
import { formatMinutes } from "@/lib/pomodoro";
import type { LastWeekSummary } from "@/lib/goals";
import { shortDate } from "@/lib/stats";

export type UpcomingSchedule = { room_id: string; name: string; icon: string; starts_at: string; timer_mode: "pomodoro" | "free" };

const timeFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });

/** 月曜のロビーに出す「先週のまとめ」 */
export function LastWeekCard({ summary }: { summary: LastWeekSummary }) {
  const diff = summary.total - summary.prevTotal;
  return (
    <section aria-labelledby="last-week" className="rounded-3xl border border-line bg-paper p-4 shadow-sm">
      <h2 id="last-week" className="mb-2 font-bold">
        📮 先週のまとめ
        <span className="ml-2 text-xs font-normal text-ink-soft">{shortDate(summary.weekStart)}〜</span>
      </h2>
      {summary.total === 0 ? (
        <p className="text-sm text-ink-soft">先週は記録がありませんでした。今週はいっしょにがんばりましょう！</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-soft">合計</dt>
            <dd className="text-lg font-bold tabular-nums">{formatMinutes(summary.total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">その前の週とくらべて</dt>
            <dd className={`text-lg font-bold tabular-nums ${diff >= 0 ? "text-green-700" : "text-ink-soft"}`}>
              {diff >= 0 ? "+" : "−"}
              {formatMinutes(Math.abs(diff))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">一番がんばった日</dt>
            <dd className="font-bold tabular-nums">
              {summary.bestDay ? `${shortDate(summary.bestDay.date)}（${formatMinutes(summary.bestDay.minutes)}）` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">よく使ったタグ</dt>
            <dd className="font-bold">{summary.tags.length ? summary.tags.map((t) => `#${t}`).join(" ") : "—"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

/** もうすぐ始まる定例（30分前から、始まって10分まで） */
export function UpcomingSchedules({ items, now }: { items: UpcomingSchedule[]; now: number }) {
  return (
    <section aria-labelledby="upcoming">
      <h2 id="upcoming" className="mb-3 font-bold">
        ⏰ もうすぐ始まる定例
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((s) => {
          const start = Date.parse(s.starts_at);
          const mins = Math.round((start - now) / 60_000);
          return (
            <li key={`${s.room_id}-${s.starts_at}`}>
              <Link
                href={`/rooms/${s.room_id}`}
                className="flex items-center gap-3 rounded-3xl border border-line bg-paper px-4 py-3 shadow-sm hover:border-accent"
              >
                <span className="text-2xl" aria-hidden>
                  {s.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className="text-xs text-ink-soft">
                    {timeFmt.format(start)} から
                    {s.timer_mode === "pomodoro" && "・ポモドーロが自動で始まります"}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-sakura/20 px-3 py-1 text-xs font-bold">
                  {mins > 0 ? `あと${mins}分` : "始まっています"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
