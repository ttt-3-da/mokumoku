"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { groupLogByDay } from "@/lib/log";
import { formatMinutes } from "@/lib/pomodoro";
import { createClient } from "@/lib/supabase/client";
import type { LogEntry } from "@/lib/types";

export function LogList({ initial, pageSize }: { initial: LogEntry[]; pageSize: number }) {
  const [entries, setEntries] = useState(initial);
  const [hasMore, setHasMore] = useState(initial.length === pageSize);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    const last = entries.at(-1);
    if (!last) return;
    setLoading(true);
    const { data } = await createClient().rpc("list_my_sessions", { p_before: last.started_at, p_limit: pageSize });
    const more = (data ?? []) as LogEntry[];
    setEntries((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))]);
    setHasMore(more.length === pageSize);
    setLoading(false);
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
        まだ記録がありません。自習室で勉強すると、ここに残っていきます。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupLogByDay(entries).map((day) => (
        <section key={day.date} aria-label={day.label}>
          <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm">
            <span className="font-bold">{day.label}</span>
            <span className="tabular-nums text-ink-soft">合計 {formatMinutes(day.totalMinutes)}</span>
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper shadow-sm">
            {day.entries.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3">
                <span className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-ink-soft">{e.timeRange}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-bold">{e.task}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {e.room_icon} {e.room_name}
                  </p>
                  {e.note && <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl bg-cream px-3 py-2 text-sm">{e.note}</p>}
                </div>
                <span className="shrink-0 text-right text-sm">
                  <b className="tabular-nums">{formatMinutes(e.minutes)}</b>
                  {e.pomodoros > 0 && <span className="block text-xs">🍅×{e.pomodoros}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hasMore && (
        <Button variant="secondary" onClick={loadMore} disabled={loading} className="self-center">
          {loading ? "読み込み中…" : "もっと見る"}
        </Button>
      )}
    </div>
  );
}
