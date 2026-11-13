import { Card } from "@/components/ui";
import { formatMinutes } from "@/lib/pomodoro";
import { grassLevel, grassWeeks, shortDate, WEEKDAY_LABELS, type ProfileStats } from "@/lib/stats";

/** 草カレンダーの濃さ（1色の明→暗。0 は学習なし） */
const GRASS = ["var(--line)", "#d3e8c9", "#a8d197", "#73ad62", "#437a37"] as const;

/**
 * プロフィールの統計：今週の合計・連続日数・累計、週グラフ、草カレンダー、タグ別の割合。
 * グラフは系列が1つなので凡例は付けず、各要素にツールチップ（title）と読み上げ用ラベルを付ける。
 */
export function ProfileStatsView({ stats }: { stats: ProfileStats }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="今週の合計" value={formatMinutes(stats.week_minutes)} />
        <StatTile label="連続日数" value={`${stats.streak_days}日`} />
        <StatTile label="累計" value={formatMinutes(stats.total_minutes)} sub={`${stats.total_sessions}回・🍅${stats.total_pomodoros}`} />
      </div>
      <WeekChart stats={stats} />
      <GrassCalendar stats={stats} />
      <TagShares stats={stats} />
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="flex flex-col items-center gap-0.5 px-2 py-4 text-center">
      <span className="text-xs text-ink-soft">{label}</span>
      <span className="text-xl font-bold tabular-nums sm:text-2xl">{value}</span>
      {sub && <span className="text-[11px] text-ink-soft">{sub}</span>}
    </Card>
  );
}

function WeekChart({ stats }: { stats: ProfileStats }) {
  const max = Math.max(60, ...stats.week.map((d) => d.minutes));
  return (
    <Card>
      <h2 className="mb-3 font-bold">今週の学習時間</h2>
      <div className="flex h-40 items-end gap-2 border-b border-line pb-px" role="img" aria-label="今週の曜日ごとの学習時間">
        {stats.week.map((d, i) => {
          const isToday = d.date === stats.today;
          const label = `${WEEKDAY_LABELS[i]}曜（${shortDate(d.date)}）${formatMinutes(d.minutes)}`;
          return (
            <div key={d.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={label}>
              <span className={`text-[11px] tabular-nums text-ink-soft ${d.minutes > 0 ? "opacity-0 group-hover:opacity-100" : "opacity-0"} ${isToday && d.minutes > 0 ? "opacity-100" : ""}`}>
                {formatMinutes(d.minutes)}
              </span>
              <span
                className="w-full max-w-10 rounded-t-[4px] bg-accent transition group-hover:brightness-95"
                style={{ height: `${(d.minutes / max) * 100}%`, minHeight: d.minutes > 0 ? 3 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2">
        {stats.week.map((d, i) => (
          <span key={d.date} className={`flex-1 text-center text-xs ${d.date === stats.today ? "font-bold text-ink" : "text-ink-soft"}`}>
            {WEEKDAY_LABELS[i]}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs text-ink-soft">
        <summary className="cursor-pointer">表で見る</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {stats.week.map((d, i) => (
              <tr key={d.date} className="border-t border-line">
                <th className="py-1 font-normal">
                  {WEEKDAY_LABELS[i]}（{shortDate(d.date)}）
                </th>
                <td className="py-1 text-right tabular-nums text-ink">{formatMinutes(d.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

function GrassCalendar({ stats }: { stats: ProfileStats }) {
  const weeks = grassWeeks(stats.calendar_start, stats.today, stats.calendar);
  const days = Object.values(stats.calendar).filter((m) => m > 0).length;
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-bold">草カレンダー</h2>
        <span className="text-xs text-ink-soft">この半年で {days} 日勉強</span>
      </div>
      <div className="overflow-x-auto overflow-y-hidden pb-1">
        <div className="flex w-max gap-[2px]" role="img" aria-label={`この半年の学習カレンダー。${days}日勉強した`}>
          <div className="mr-1 flex flex-col gap-[2px] text-[9px] leading-[11px] text-ink-soft">
            {WEEKDAY_LABELS.map((w, i) => (
              <span key={w} className="h-[11px]">
                {i % 2 === 0 ? w : ""}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day, di) =>
                day ? (
                  <span
                    key={di}
                    className="h-[11px] w-[11px] rounded-[3px] hover:outline hover:outline-1 hover:outline-ink-soft"
                    style={{ background: GRASS[grassLevel(day.minutes)] }}
                    title={`${shortDate(day.date)} ${day.minutes > 0 ? formatMinutes(day.minutes) : "なし"}`}
                  />
                ) : (
                  <span key={di} className="h-[11px] w-[11px]" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-ink-soft" aria-hidden>
        少ない
        {GRASS.map((c) => (
          <span key={c} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: c }} />
        ))}
        多い
      </div>
    </Card>
  );
}

function TagShares({ stats }: { stats: ProfileStats }) {
  const total = stats.tags.reduce((s, t) => s + t.minutes, 0);
  return (
    <Card>
      <h2 className="mb-3 font-bold">タグ別の割合</h2>
      {total === 0 ? (
        <p className="text-sm text-ink-soft">まだ記録がありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stats.tags.map((t) => {
            const pct = Math.round((t.minutes / total) * 100);
            return (
              <li key={t.tag} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2 text-sm" title={`${t.tag}：${formatMinutes(t.minutes)}（${pct}%）`}>
                <span className="truncate">#{t.tag}</span>
                <span className="h-3 overflow-hidden rounded-full bg-cream">
                  <span className="block h-full rounded-full bg-yomogi" style={{ width: `${Math.max(pct, 2)}%` }} />
                </span>
                <span className="w-24 text-right text-xs tabular-nums text-ink-soft">
                  {pct}%・{formatMinutes(t.minutes)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
