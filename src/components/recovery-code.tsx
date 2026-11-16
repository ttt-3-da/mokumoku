"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

/** ABCD2345EFGH → ABCD-2345-EFGH */
export function formatRecoveryCode(code: string) {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

/** 作った復活コードを見せる（このときしか見られない） */
export function RecoveryCodeBox({ code, username }: { code: string; username: string }) {
  const [copied, setCopied] = useState(false);
  const text = formatRecoveryCode(code);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-accent bg-cream p-4">
      <p className="text-xs text-ink-soft">ユーザーID：<b className="text-ink">{username}</b></p>
      <p className="select-all text-center font-mono text-2xl font-bold tracking-widest" aria-label="復活コード">
        {text}
      </p>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`Mokumoku ユーザーID：${username} 復活コード：${text}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // コピーできないブラウザでは、スクショか手で書き写してもらう
          }
        }}
      >
        {copied ? "✅ コピーしました" : "📋 コピーする"}
      </Button>
      <p className="text-xs leading-relaxed text-ink-soft">
        ⚠️ このコードは<b>今しか表示されません</b>。スクショを撮るか、メモ帳や紙に書いて、なくさない場所に保存してください。
        ほかの人には見せないでください（このコードがあると、パスワードを変えられてしまいます）。
      </p>
    </div>
  );
}

/** 復活コードを作る・作り直すボタン */
export function RecoveryCodeMaker({ username, hasCode }: { username: string; hasCode: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function make() {
    if (hasCode && !window.confirm("作り直すと、前の復活コードは使えなくなります。作り直しますか？")) return;
    setError(null);
    startTransition(async () => {
      const { data, error } = await createClient().rpc("issue_recovery_code");
      if (error || typeof data !== "string") return setError(error ? rpcErrorMessage(error) : "作れませんでした");
      setCode(data);
    });
  }

  if (code) return <RecoveryCodeBox code={code} username={username} />;
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={make} disabled={pending} variant={hasCode ? "secondary" : undefined}>
        {pending ? "作っています…" : hasCode ? "🔑 復活コードを作り直す" : "🔑 復活コードを作る"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
