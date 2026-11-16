"use client";

import Link from "next/link";
import { useActionState } from "react";
import { RecoveryCodeBox } from "@/components/recovery-code";
import { Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { resetPassword, type ResetState } from "./actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});

  if (state.newCode && state.username) {
    return (
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-paper p-6 shadow-sm">
        <p role="status" className="font-bold">
          ✅ パスワードを変えました
        </p>
        <p className="text-sm text-ink-soft">
          今使った復活コードは、もう使えません。<b className="text-ink">新しい復活コード</b>を保存してください。
        </p>
        <RecoveryCodeBox code={state.newCode} username={state.username} />
        <ButtonLink href="/lobby">保存したので、ロビーへ →</ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-3xl border border-line bg-paper p-6 shadow-sm">
      <Field label="ユーザーID" htmlFor="reset-username">
        <input id="reset-username" name="username" autoComplete="username" required defaultValue={state.username} className={inputClass} />
      </Field>
      <Field label="復活コード" htmlFor="reset-code" hint="例：ABCD-2345-EFGH（小文字やハイフンなしでもOK）">
        <input id="reset-code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required className={`${inputClass} font-mono`} />
      </Field>
      <Field label="新しいパスワード" htmlFor="reset-password" hint="8文字以上">
        <input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <Field label="新しいパスワード（確認）" htmlFor="reset-confirm">
        <input id="reset-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "変えています…" : "パスワードを変える"}
      </Button>
      <p className="text-xs leading-relaxed text-ink-soft">
        復活コードもなくしてしまったときは、残念ですがアカウントを元に戻せません。新しく登録してください。
      </p>
      <Link href="/login" className="text-center text-sm underline">
        ログインにもどる
      </Link>
    </form>
  );
}
