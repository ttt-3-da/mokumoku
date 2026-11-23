"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { formatMinutes } from "@/lib/pomodoro";
import { WEEKDAY_LABELS } from "@/lib/stats";
import {
  buildInsights,
  canGoBack,
  CHRONOTYPE_LABEL,
  INSIGHT_PERIODS,
  parseInsightPeriod,
  periodLabel,
  periodStartIso,
  type InsightPeriod,
  type StudyRow,
} from "@/lib/study-insights";
import { createClient } from "@/lib/supabase/client";

const PERIOD_KEY = "mokumoku:insight-period";

/** 記録ページ上のふり返り。期間を切り替えると、その期間のセッションを読み直して集計する。
 *  「‹」「›」で先週・先月など前の期間もさかのぼれる */
export function Insights() {
  const [period, setPeriod] = useState<InsightPeriod>("week");
  // 0 が今の期間、-1 が1つ前
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<{ key: string; rows: StudyRow[] } | null>(null);
  const key = `${period}:${offset}`;
  const [error, setError] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setPeriod(parseInsightPeriod(localStorage.getItem(PERIOD_KEY)));
      } catch {
        // 今週のまま
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let alive = true;
    createClient()
      .rpc("list_my_study_stats", { p_from: periodStartIso(period, new Date(), offset) })
      .then(({ data, error }) => {
        if (!alive) return;
        setError(Boolean(error));
        setRows({ key: `${period}:${offset}`, rows: (data ?? []) as StudyRow[] });
      });
    return () => {
      alive = false;
    };
  }, [period, offset]);

  const insights = useMemo(() => (rows && rows.key === key ? buildInsights(rows.rows, period, new Date(), offset) : null), [rows, key, period, offset]);
  const now = new Date();
  const label = periodLabel(period, now, offset);

  function change(p: InsightPeriod) {
    setPeriod(p);
    setOffset(0);
    try {
      localStorage.setItem(PERIOD_KEY, p);
    } catch {
      // 保存できなくても切り替えはできる
    }
  }

  return (
    <section aria-labelledby="insights" className="mb-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="insights" className="font-bold">
          ふり返り
        </h2>
        <div className="ml-auto flex gap-1" role="tablist" aria-label="期間">
          {(Object.keys(INSIGHT_PERIODS) as InsightPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => change(p)}
              className={`rounded-full px-3 py-1 text-sm ${p === period ? "bg-ink font-bold text-paper" : "bg-paper hover:bg-sakura/20"}`}
            >
              {INSIGHT_PERIODS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2" aria-label="期間をさかのぼる">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          disabled={!canGoBack(period, now, offset)}
          aria-label="前の期間"
          className="rounded-full bg-paper px-3 py-1 text-sm hover:bg-sakura/20 disabled:opacity-30"
        >
          ‹ 前へ
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-bold" aria-live="polite">
          {label}
        </p>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          aria-label="次の期間"
          className="rounded-full bg-paper px-3 py-1 text-sm hover:bg-sakura/20 disabled:opacity-30"
        >
          次へ ›
        </button>
      </div>
      {offset < -1 && (
        <button type="button" onClick={() => setOffset(0)} className="-mt-2 self-center text-xs text-ink-soft underline">
          {INSIGHT_PERIODS[period]}に戻る
        </button>
      )}

      {error ? (
        <p className="text-sm text-red-600">ふり返りを読み込めませんでした。</p>
      ) : !insights ? (
        <div className="h-64 animate-pulse rounded-3xl bg-paper" aria-label="読み込み中" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="合計" value={formatMinutes(insights.total)} />
            <Tile label="回数" value={`${insights.sessions}回`} />
            <Tile label="1回あたり" value={formatMinutes(insights.averageSession)} />
            <Tile label="ポモドーロ" value={`🍅${insights.pomodoros}`} />
          </div>

          <Card>
            <h3 className="mb-3 text-sm font-bold">
              {insights.barUnit === "day" ? "日ごと" : insights.barUnit === "week" ? "週ごと" : "月ごと"}の学習時間
            </h3>
            <Bars
              items={insights.bars.map((b) => ({ key: b.key, label: b.label, minutes: b.minutes }))}
              labelEvery={insights.bars.length > 16 ? 5 : 1}
              ariaLabel="期間の学習時間の棒グラフ"
            />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="mb-1 text-sm font-bold">時間帯</h3>
              <p className="mb-3 text-xs text-ink-soft">{insights.chronotype ? CHRONOTYPE_LABEL[insights.chronotype] : "まだ記録がありません"}</p>
              <Bars
                items={insights.hours.map((m, h) => ({ key: String(h), label: String(h), minutes: m }))}
                labelEvery={6}
                ariaLabel="時間帯ごとの学習時間"
                small
              />
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-bold">曜日ごとの平均（1日あたり）</h3>
              <Bars
                items={insights.weekdayAverage.map((m, i) => ({ key: String(i), label: WEEKDAY_LABELS[i], minutes: m }))}
                labelEvery={1}
                ariaLabel="曜日ごとの平均学習時間"
                small
              />
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Shares title="タグごと" items={insights.tags.map((t) => ({ name: `#${t.name}`, minutes: t.minutes }))} />
            <Shares title="部屋ごと" items={insights.rooms.map((r) => ({ name: `${r.icon} ${r.name}`, minutes: r.minutes }))} />
          </div>
        </>
      )}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
      <span className="text-xs text-ink-soft">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </Card>
  );
}

/** 系列が1つの棒グラフ。値はホバー（title）と「表で見る」で読める */
function Bars({
  items,
  labelEvery,
  ariaLabel,
  small = false,
}: {
  items: { key: string; label: string; minutes: number }[];
  labelEvery: number;
  ariaLabel: string;
  small?: boolean;
}) {
  const max = Math.max(30, ...items.map((i) => i.minutes));
  return (
    <>
      <div className={`flex items-end gap-px border-b border-line pb-px sm:gap-0.5 ${small ? "h-24" : "h-36"}`} role="img" aria-label={ariaLabel}>
        {items.map((i) => (
          <div key={i.key} className="group flex h-full flex-1 items-end" title={`${i.label}：${formatMinutes(i.minutes)}`}>
            <span
              className="w-full rounded-t-[3px] bg-accent transition group-hover:brightness-95"
              style={{ height: `${(i.minutes / max) * 100}%`, minHeight: i.minutes > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-px sm:gap-0.5" aria-hidden>
        {items.map((i, idx) => (
          <span key={i.key} className="flex-1 text-center text-[10px] text-ink-soft">
            {idx % labelEvery === 0 ? i.label : ""}
          </span>
        ))}
      </div>
      <details className="mt-2 text-xs text-ink-soft">
        <summary className="cursor-pointer">表で見る</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {items.map((i) => (
              <tr key={i.key} className="border-t border-line">
                <th className="py-0.5 font-normal">{i.label}</th>
                <td className="py-0.5 text-right tabular-nums text-ink">{formatMinutes(i.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

function Shares({ title, items }: { title: string; items: { name: string; minutes: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.minutes));
  return (
    <Card>
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">まだ記録がありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.name} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-sm">
              <span className="truncate" title={i.name}>
                {i.name}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-cream">
                <span className="block h-full rounded-full bg-yomogi" style={{ width: `${Math.max((i.minutes / max) * 100, 2)}%` }} />
              </span>
              <span className="text-right text-xs tabular-nums text-ink-soft">{formatMinutes(i.minutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
