"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, inputClass } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { FEEDBACK_KINDS, FEEDBACK_MAX, type FeedbackKind } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/client";

export function FeedbackForm() {
  const router = useRouter();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setMessage(null);
    start(async () => {
      const { error } = await createClient().rpc("send_feedback", { p_kind: kind, p_body: body, p_page: document.referrer.slice(0, 200) });
      if (error) {
        setMessage({ ok: false, text: rpcErrorMessage(error) });
        return;
      }
      setBody("");
      setMessage({ ok: true, text: "送りました。ありがとうございます！" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-bold">種類</legend>
        {(Object.entries(FEEDBACK_KINDS) as [FeedbackKind, string][]).map(([k, label]) => (
          <label
            key={k}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sakura ${kind === k ? "bg-ink font-bold text-paper" : "bg-cream hover:bg-sakura/20"}`}
          >
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="feedback-body" className="text-sm font-bold">
          内容
        </label>
        <textarea
          id="feedback-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={FEEDBACK_MAX}
          rows={6}
          placeholder={kind === "bug" ? "どの画面で、何をしたら、どうなったかを書いてもらえると助かります" : "思ったことを自由に書いてください"}
          className={inputClass}
        />
        <span className="self-end text-xs tabular-nums text-ink-soft">
          {body.length} / {FEEDBACK_MAX}
        </span>
      </div>
      <Button type="submit" disabled={pending || !body.trim()}>
        {pending ? "送っています…" : "送る"}
      </Button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
