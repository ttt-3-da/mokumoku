"use client";

import { useState, useTransition } from "react";
import { Button, Card, inputClass } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_MESSAGE = "フィードバックを送ってみませんか？ 使ってみた感想や「こうなったらいいな」を、意見箱から気軽に教えてください。";
const AUDIENCES = [
  { value: "active", label: "最近7日間に勉強した人" },
  { value: "all", label: "全員" },
] as const;
type Audience = (typeof AUDIENCES)[number]["value"];

/** みんなのお知らせ（🔔）に「フィードバックを送ってみませんか？」を送る。押すと意見箱が開く */
export function FeedbackRequestForm() {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [audience, setAudience] = useState<Audience>("active");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setResult(null);
    start(async () => {
      const supabase = createClient();
      const { data: count, error: countError } = await supabase.rpc("admin_feedback_audience_count", { p_audience: audience });
      if (countError) return setResult({ ok: false, text: rpcErrorMessage(countError) });
      const label = AUDIENCES.find((a) => a.value === audience)!.label;
      if (count === 0) return setResult({ ok: false, text: `「${label}」に当てはまる人がいません。` });
      if (!window.confirm(`「${label}」の ${count}人 のお知らせに送ります。よろしいですか？（取り消せません）`)) return;
      const { data, error } = await supabase.rpc("admin_send_feedback_request", { p_message: message, p_audience: audience });
      if (error) return setResult({ ok: false, text: rpcErrorMessage(error) });
      setResult({ ok: true, text: `${data}人に送りました。` });
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-bold">📮 フィードバックをお願いする</h2>
      <p className="text-xs text-ink-soft">みんなのお知らせ（🔔）に届きます。押すと意見箱が開きます。</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">お知らせの文</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={140}
          rows={3}
          className={inputClass}
          aria-label="お知らせの文"
        />
        <span className="self-end text-xs text-ink-soft">{message.trim().length}/140</span>
      </label>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-bold">送る相手</legend>
        {AUDIENCES.map((a) => (
          <label key={a.value} className="flex items-center gap-1.5">
            <input type="radio" name="audience" value={a.value} checked={audience === a.value} onChange={() => setAudience(a.value)} />
            {a.label}
          </label>
        ))}
      </fieldset>
      <Button onClick={send} disabled={pending || message.trim().length === 0}>
        {pending ? "送っています…" : "お知らせを送る"}
      </Button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-ink" : "text-red-600"}`}>
          {result.ok ? "✅ " : ""}
          {result.text}
        </p>
      )}
    </Card>
  );
}
