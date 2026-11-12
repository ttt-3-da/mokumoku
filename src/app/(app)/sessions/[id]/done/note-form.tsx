"use client";

import { useActionState, useState } from "react";
import { Button, ButtonLink, inputClass } from "@/components/ui";
import { charLength, NOTE_MAX } from "@/lib/validation";
import { saveNote, type NoteState } from "./actions";

/** 記録は自動で残る。ここでは任意のメモだけを付ける（自分にしか見えない） */
export function NoteForm({ sessionId, initial }: { sessionId: string; initial: string }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(saveNote.bind(null, sessionId), {});
  const [note, setNote] = useState(initial);
  const len = charLength(note.trim());

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="note" className="text-sm font-bold">
        メモ（任意・自分にだけ見えます）
      </label>
      <textarea
        id="note"
        name="note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="例：長文読解は時間を計ると集中できた"
        className={inputClass}
      />
      <p className={`text-right text-xs tabular-nums ${len > NOTE_MAX ? "text-red-600" : "text-ink-soft"}`}>
        {len}/{NOTE_MAX}
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink href="/lobby" variant="secondary">
          ロビーへ
        </ButtonLink>
        <Button type="submit" disabled={pending || len > NOTE_MAX}>
          {pending ? "保存中…" : "記録を見る"}
        </Button>
      </div>
    </form>
  );
}
