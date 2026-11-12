import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { LogEntry } from "@/lib/types";
import { LogList } from "./log-list";

export const metadata: Metadata = { title: "記録" };

const PAGE_SIZE = 30;

/** 自分だけの学習記録（ほかの人の記録は見えない） */
export default async function LogPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_sessions", { p_limit: PAGE_SIZE });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">記録</h1>
      <p className="mb-5 mt-1 text-xs text-ink-soft">自分だけに見える学習の記録です。退室すると自動で残ります（1分以上）。</p>
      {error ? (
        <p className="text-sm text-red-600">読み込めませんでした。</p>
      ) : (
        <LogList initial={(data ?? []) as LogEntry[]} pageSize={PAGE_SIZE} />
      )}
    </div>
  );
}
