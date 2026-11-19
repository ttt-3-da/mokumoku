"use client";

import { useState, useTransition } from "react";
import { Button, Card, inputClass } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import type { UserRow } from "./admin-view";

const DEFAULT_MESSAGE = "フィードバックを送ってみませんか？ 使ってみた感想や「こうなったらいいな」を、意見箱から気軽に教えてください。";
const AUDIENCES = [
  { value: "active", label: "最近7日間に勉強した人" },
  { value: "all", label: "全員" },
  { value: "not_yet", label: "まだ受け取っていない人" },
  { value: "pick", label: "人を選ぶ" },
] as const;
type Audience = (typeof AUDIENCES)[number]["value"];

/** みんなのお知らせ（🔔）に「フィードバックを送ってみませんか？」を送る。押すと意見箱が開く */
export function FeedbackRequestForm({ users }: { users: UserRow[] }) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [audience, setAudience] = useState<Audience>("active");
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setResult(null);
    start(async () => {
      const supabase = createClient();
      const { data: count, error: countError } = await supabase.rpc("admin_feedback_audience_count", { p_audience: audience, p_user_ids: audience === "pick" ? picked : null });
      if (countError) return setResult({ ok: false, text: rpcErrorMessage(countError) });
      const label = AUDIENCES.find((a) => a.value === audience)!.label;
      if (count === 0) return setResult({ ok: false, text: `「${label}」に当てはまる人がいません。` });
      if (!window.confirm(`「${label}」の ${count}人 のお知らせに送ります。よろしいですか？（取り消せません）`)) return;
      const { data, error } = await supabase.rpc("admin_send_feedback_request", {
        p_message: message,
        p_audience: audience,
        p_user_ids: audience === "pick" ? picked : null,
      });
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
      {audience === "pick" && <PeoplePicker users={users} picked={picked} onChange={setPicked} />}
      <Button onClick={send} disabled={pending || message.trim().length === 0 || (audience === "pick" && picked.length === 0)}>
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

/** お知らせを送る人を選ぶ。名前・ユーザーIDでしぼりこんで、チェックを付ける */
function PeoplePicker({ users, picked, onChange }: { users: UserRow[]; picked: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const candidates = users.filter((u) => !u.suspended_at);
  const query = q.trim().toLowerCase();
  const shown = (query ? candidates.filter((u) => u.username.includes(query) || u.display_name.toLowerCase().includes(query)) : candidates).slice(0, 50);
  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const pickedUsers = candidates.filter((u) => picked.includes(u.id));

  return (
    <div className="flex flex-col gap-2 text-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="名前かユーザーIDでさがす"
        aria-label="送る人をさがす"
        className={inputClass}
      />
      {pickedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="選んだ人">
          {pickedUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              className="rounded-full bg-sakura/20 px-2 py-0.5 text-xs hover:bg-sakura/30"
              aria-label={`${u.display_name}を外す`}
            >
              {u.display_name} ✕
            </button>
          ))}
        </div>
      )}
      <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-xl border border-line bg-paper p-1">
        {shown.length === 0 && <li className="px-2 py-1 text-xs text-ink-soft">見つかりません</li>}
        {shown.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-cream">
              <input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />
              <span className="min-w-0 flex-1 truncate">
                {u.display_name} <span className="text-xs text-ink-soft">@{u.username}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <span className="text-xs text-ink-soft">{picked.length}人を選んでいます</span>
    </div>
  );
}
