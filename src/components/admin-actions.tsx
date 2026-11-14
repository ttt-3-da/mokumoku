"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

type Action = { label: string; confirm: string; rpc: string; args: Record<string, unknown>; danger?: boolean; after?: string };

/** 管理者だけに出す操作ボタン（利用停止・文字を消す・部屋の削除 など） */
export function AdminActions({ actions, className = "" }: { actions: Action[]; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run(a: Action) {
    if (!window.confirm(a.confirm)) return;
    setMessage(null);
    start(async () => {
      const { error } = await createClient().rpc(a.rpc, a.args);
      if (error) {
        setMessage({ ok: false, text: rpcErrorMessage(error) });
        return;
      }
      setMessage({ ok: true, text: `「${a.label}」をしました` });
      if (a.after) router.push(a.after);
      else router.refresh();
    });
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-accent/60 p-2 text-xs ${className}`}>
      <span className="font-bold text-accent-strong">管理者</span>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          disabled={pending}
          onClick={() => run(a)}
          className={`rounded-full px-3 py-1 font-bold disabled:opacity-50 ${a.danger ? "bg-red-500 text-white hover:bg-red-600" : "bg-paper shadow-sm hover:bg-sakura/20"}`}
        >
          {a.label}
        </button>
      ))}
      {message && (
        <span role={message.ok ? "status" : "alert"} className={message.ok ? "text-green-700" : "text-red-600"}>
          {message.text}
        </span>
      )}
    </div>
  );
}
