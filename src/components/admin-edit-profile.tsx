"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

/** 管理者が、ほかの人の表示名と自己紹介を書きかえる */
export function AdminEditProfile({ userId, displayName, bio }: { userId: string; displayName: string; bio: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [text, setText] = useState(bio);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 rounded-full bg-paper px-3 py-1 text-xs font-bold shadow-sm hover:bg-sakura/20">
        管理者：名前と自己紹介を変える
      </button>
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const { error } = await createClient().rpc("admin_set_user_text", { p_user_id: userId, p_display_name: name, p_bio: text });
      if (error) {
        setMessage({ ok: false, text: rpcErrorMessage(error) });
        return;
      }
      setMessage({ ok: true, text: "変えました" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="mt-2 flex flex-col gap-2 rounded-2xl border border-dashed border-accent/60 p-2 text-xs">
      <label className="flex flex-col gap-1">
        <span className="font-bold">表示名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">自己紹介</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} className={inputClass} />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending || !name.trim()} className="rounded-full bg-accent px-4 py-1.5 font-bold text-white hover:bg-accent-strong disabled:opacity-50">
          {pending ? "保存中…" : "保存"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-cream">
          とじる
        </button>
        {message && (
          <span role={message.ok ? "status" : "alert"} className={message.ok ? "text-green-700" : "text-red-600"}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
