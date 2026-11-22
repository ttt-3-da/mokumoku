"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { MAX_TAGS, ROOM_ICONS, validateRoomInfo } from "@/lib/validation";

type EditableRoom = { id: string; name: string; description: string | null; icon: string; tags: string[] | null };

/** 部屋の名前・説明・アイコン・タグを、作ったあとから変える（オーナーのみ） */
export function RoomInfoEditor({ room }: { room: EditableRoom }) {
  const router = useRouter();
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [icon, setIcon] = useState(room.icon);
  const [tags, setTags] = useState((room.tags ?? []).join(" "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const changed = name !== room.name || description !== (room.description ?? "") || icon !== room.icon || tags !== (room.tags ?? []).join(" ");

  async function save() {
    setMessage(null);
    const v = validateRoomInfo({ name, description, icon, tags });
    if (!v.ok) return setMessage({ ok: false, text: v.error });
    setSaving(true);
    // PATCH ではなく RPC（POST）で送る。Mac の Safari で rooms への PATCH が送られないことがあったため
    const { error } = await createClient().rpc("update_room_info", {
      p_room_id: room.id,
      p_name: v.value.name,
      p_description: v.value.description,
      p_icon: v.value.icon,
      p_tags: v.value.tags,
    });
    setSaving(false);
    if (error) return setMessage({ ok: false, text: error.message === "ng_word" || error.message === "forbidden" ? rpcErrorMessage(error) : "保存できませんでした" });
    setName(v.value.name);
    setDescription(v.value.description);
    setTags(v.value.tags.join(" "));
    setMessage({ ok: true, text: "部屋の情報を保存しました" });
    router.refresh();
  }

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setMessage(null);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-bold">部屋の情報</legend>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft">部屋名（1〜40文字）</span>
        <input value={name} onChange={(e) => edit(setName)(e.target.value)} maxLength={40} aria-label="部屋名" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft">説明（200文字以内）</span>
        <textarea value={description} onChange={(e) => edit(setDescription)(e.target.value)} maxLength={200} rows={2} aria-label="説明" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft">タグ（スペースかカンマ区切りで{MAX_TAGS}個まで）</span>
        <input value={tags} onChange={(e) => edit(setTags)(e.target.value)} aria-label="タグ" className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="アイコン">
        {ROOM_ICONS.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={icon === i}
            onClick={() => edit(setIcon)(i)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg ${icon === i ? "border-accent bg-sakura/20" : "border-line bg-paper hover:bg-sakura/10"}`}
          >
            {i}
          </button>
        ))}
      </div>
      <Button onClick={save} disabled={saving || !changed} className="self-end !px-4 !py-1.5">
        {saving ? "保存中…" : "部屋の情報を保存"}
      </Button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </fieldset>
  );
}

