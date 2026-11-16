"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "./actions";
import { Button, Field, inputClass } from "@/components/ui";

type Mode = "signin" | "signup";

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin");

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm">
      <div role="tablist" className="mb-6 grid grid-cols-2 rounded-full bg-cream p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full py-2 transition ${
              mode === m ? "bg-paper font-bold shadow-sm" : "text-ink-soft"
            }`}
          >
            {m === "signin" ? "ログイン" : "新規登録"}
          </button>
        ))}
      </div>
      {mode === "signin" ? <SignInForm next={next} /> : <SignUpForm />}
    </div>
  );
}

function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="ユーザーID" htmlFor="signin-username">
        <input
          id="signin-username"
          name="username"
          autoComplete="username"
          required
          defaultValue={state.username}
          className={inputClass}
        />
      </Field>
      <Field label="パスワード" htmlFor="signin-password">
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      {state.error && <ErrorText>{state.error}</ErrorText>}
      <Button type="submit" disabled={pending}>
        {pending ? "ログイン中…" : "ログイン"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="ユーザーID" htmlFor="signup-username" hint="英数字と _ で3〜20文字。あとから変更できません">
        <input
          id="signup-username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          defaultValue={state.username}
          className={inputClass}
        />
      </Field>
      <Field label="表示名" htmlFor="signup-display" hint="1〜30文字。あとから変更できます">
        <input
          id="signup-display"
          name="display_name"
          maxLength={30}
          defaultValue={state.displayName}
          className={inputClass}
        />
      </Field>
      <Field label="パスワード" htmlFor="signup-password" hint="8文字以上">
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </Field>
      <p className="text-xs leading-relaxed text-ink-soft">
        メールアドレスは使いません。そのぶん、パスワードを忘れると再設定できないので大切に保管してください。
      </p>
      <p className="text-xs leading-relaxed text-ink-soft">
        「はじめる」を押すと、
        <Link href="/terms" target="_blank" className="underline">
          利用規約
        </Link>
        と
        <Link href="/privacy" target="_blank" className="underline">
          プライバシーポリシー
        </Link>
        に同意したことになります。
      </p>
      {state.error && <ErrorText>{state.error}</ErrorText>}
      <Button type="submit" disabled={pending}>
        {pending ? "登録中…" : "はじめる"}
      </Button>
    </form>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}
