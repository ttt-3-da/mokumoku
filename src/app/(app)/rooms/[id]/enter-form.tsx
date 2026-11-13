"use client";

import { useActionState, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { TASK_MAX } from "@/lib/validation";
import { enterRoom, type EnterState } from "./actions";

export function EnterForm({
  roomId,
  history,
  inviteCode,
}: {
  roomId: string;
  history: string[];
  inviteCode: string | null;
}) {
  const [state, action, pending] = useActionState<EnterState, FormData>(enterRoom.bind(null, roomId, inviteCode), {});
  const [task, setTask] = useState("");

  if (state.pending) {
    return (
      <p className="text-center text-sm">
        入室を申請しました。オーナーが承認すると入れるようになります。
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="今からやること" htmlFor="task" hint={`${TASK_MAX}文字以内・必須`}>
        <input
          id="task"
          name="task"
          required
          maxLength={TASK_MAX}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="例：英単語を100個"
          className={inputClass}
        />
      </Field>
      {history.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="過去の入力から選ぶ">
          {history.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setTask(h)}
              className="max-w-full truncate rounded-full bg-cream px-3 py-1 text-xs hover:bg-sakura/20"
            >
              {h}
            </button>
          ))}
        </div>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {/* 空かどうかは input の required とサーバーで確かめる（ページの準備前に入力されても押せるように） */}
      <Button type="submit" disabled={pending}>
        {pending ? "入室中…" : "入室する"}
      </Button>
    </form>
  );
}
