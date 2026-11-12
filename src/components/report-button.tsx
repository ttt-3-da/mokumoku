"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const REASONS = ["不適切な名前・内容", "迷惑行為", "スパム・宣伝", "その他"] as const;

const TARGET_LABEL = { room: "この部屋", user: "この人", post: "この投稿" } as const;

/**
 * 通報ボタン。部屋・ユーザー・投稿を通報できる（同じ相手は1回まで）。
 * 通報は reports テーブルに保存され、運営が Supabase の管理画面で確認する。
 */
export function ReportButton({
  targetType,
  targetId,
  className = "",
}: {
  targetType: keyof typeof TARGET_LABEL;
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function send() {
    setState("sending");
    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const { error } = await supabase.from("reports").insert({
      reporter_id: claims?.claims?.sub,
      target_type: targetType,
      target_id: targetId,
      reason: `${reason}${detail.trim() ? `：${detail.trim()}` : ""}`.slice(0, 200),
    });
    // 23505 = すでに通報済み。もう一度送ったのと同じ扱いにする
    setState(!error || error.code === "23505" ? "done" : "error");
  }

  if (state === "done") {
    return <span className={`text-xs text-ink-soft ${className}`}>通報を受け付けました</span>;
  }

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-xs text-ink-soft underline-offset-2 hover:text-red-700 hover:underline"
      >
        🚩 通報
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={`${TARGET_LABEL[targetType]}を通報`}
          className="absolute right-0 z-30 mt-1 flex w-64 flex-col gap-2 rounded-2xl border border-line bg-paper p-3 text-left text-sm shadow-lg"
        >
          <span className="font-bold">{TARGET_LABEL[targetType]}を通報</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="通報の理由"
            className="rounded-xl border border-line bg-cream px-2 py-1.5"
          >
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={150}
            rows={2}
            placeholder="くわしく（任意）"
            aria-label="くわしい内容"
            className="rounded-xl border border-line bg-cream px-2 py-1.5"
          />
          {state === "error" && (
            <span role="alert" className="text-xs text-red-600">
              送れませんでした。時間をおいて試してください。
            </span>
          )}
          <span className="flex justify-end gap-2">
            <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setOpen(false)}>
              やめる
            </Button>
            <Button variant="danger" className="px-3 py-1 text-xs" disabled={state === "sending"} onClick={send}>
              通報する
            </Button>
          </span>
        </span>
      )}
    </span>
  );
}
