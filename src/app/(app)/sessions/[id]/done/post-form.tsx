"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { createPost, type PostState } from "./actions";

const MAX = 280;

/** この勉強を「みんな」に投稿する。投稿するかどうかは自分で決める */
export function PostForm({ sessionId, posted, isPublic }: { sessionId: string; posted: boolean; isPublic: boolean }) {
  const [state, action, pending] = useActionState<PostState, FormData>(createPost.bind(null, sessionId), {});
  const [body, setBody] = useState("");
  const len = [...body.trim()].length;

  if (posted) {
    return (
      <p className="text-center text-sm">
        📣 この記録は投稿しました。
        <Link href="/feed" className="ml-1 font-bold underline">
          みんなの記録を見る
        </Link>
      </p>
    );
  }
  if (!isPublic) {
    return (
      <p className="text-center text-xs text-ink-soft">
        プロフィールを公開にすると、この記録をみんなに投稿できます（
        <Link href="/settings" className="underline">
          設定
        </Link>
        ）。
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="post-body" className="text-sm font-bold">
        📣 みんなに投稿する（任意）
      </label>
      <p className="-mt-2 text-xs text-ink-soft">勉強した時間・やったこと・部屋・終わらせたToDoの数が、ひとことといっしょに出ます。</p>
      <textarea
        id="post-body"
        name="body"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="ひとこと（例：長文読解、時間内に解けた！）"
        className={inputClass}
      />
      <p className={`-mt-2 text-right text-xs tabular-nums ${len > MAX ? "text-red-600" : "text-ink-soft"}`}>
        {len}/{MAX}
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending || len > MAX}>
        {pending ? "投稿中…" : "投稿する"}
      </Button>
    </form>
  );
}
