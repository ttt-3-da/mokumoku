"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

/** ブロックする・解除するボタン。ブロックするときは確認する */
export function BlockButton({ username, displayName, initialBlocking, className = "" }: { username: string; displayName: string; initialBlocking: boolean; className?: string }) {
  const router = useRouter();
  const [blocking, setBlocking] = useState(initialBlocking);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !blocking;
    if (next && !confirm(`${displayName} さんをブロックしますか？\nおたがいのフォローが外れ、おたがいのもちやスタンプが見えなくなります（あとで解除できます）。`)) return;
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().rpc(next ? "block_user" : "unblock_user", { p_username: username });
      if (error) {
        setError(rpcErrorMessage(error));
        return;
      }
      setBlocking(next);
      router.refresh();
    });
  }

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button type="button" onClick={toggle} disabled={pending} className="text-sm text-ink-soft hover:underline disabled:opacity-50">
        {blocking ? "ブロックを解除" : "🚫 ブロック"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
