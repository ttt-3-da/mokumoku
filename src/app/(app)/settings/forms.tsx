"use client";

import { useActionState, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { BIO_MAX, charLength } from "@/lib/validation";
import { changePassword, deleteAccount, updateProfile, updateVisibility, type FormState } from "./actions";

function Message({ state, okText }: { state: FormState; okText: string }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.saved) {
    return (
      <p role="status" className="text-sm text-green-700">
        {okText}
      </p>
    );
  }
  return null;
}

export function ProfileForm({ displayName, bio }: { displayName: string; bio: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  const [text, setText] = useState(bio);
  const len = charLength(text.trim());

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="表示名" htmlFor="display_name" hint="1〜30文字">
        <input id="display_name" name="display_name" defaultValue={displayName} required maxLength={30} className={inputClass} />
      </Field>
      <Field label="自己紹介" htmlFor="bio" hint={`${BIO_MAX}文字以内・任意`}>
        <textarea
          id="bio"
          name="bio"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例：社会人2年目。朝の1時間で資格の勉強をしています。"
          className={inputClass}
        />
      </Field>
      <p className={`-mt-2 text-right text-xs tabular-nums ${len > BIO_MAX ? "text-red-600" : "text-ink-soft"}`}>
        {len}/{BIO_MAX}
      </p>
      <Message state={state} okText="保存しました" />
      <Button type="submit" disabled={pending || len > BIO_MAX} className="self-end">
        {pending ? "保存中…" : "保存する"}
      </Button>
    </form>
  );
}

export function VisibilityForm({ isPublic, statsPublic }: { isPublic: boolean; statsPublic: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateVisibility, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <Toggle
        name="is_public"
        defaultChecked={isPublic}
        label="プロフィールを公開する"
        hint="オフにすると、ほかの人はあなたのプロフィールを開けず、ユーザー検索にも出ません。"
      />
      <Toggle
        name="stats_public"
        defaultChecked={statsPublic}
        label="学習の統計を見せる"
        hint="今週の合計・連続日数・草カレンダー・タグ別の割合を、プロフィールに表示します（プロフィールが公開のときだけ）。"
      />
      <Message state={state} okText="保存しました" />
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "保存中…" : "保存する"}
      </Button>
    </form>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
  disabled = false,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-3 ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--accent-strong)]"
      />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
    </label>
  );
}

export function PasswordForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {/* パスワード管理ソフトがどのアカウントか分かるように */}
      <input type="text" name="username" autoComplete="username" defaultValue={username} hidden readOnly />
      <Field label="今のパスワード" htmlFor="current_password">
        <input id="current_password" name="current_password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field label="新しいパスワード" htmlFor="new_password" hint="8文字以上">
        <input id="new_password" name="new_password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <Field label="新しいパスワード（確認）" htmlFor="confirm_password">
        <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <Message state={state} okText="パスワードを変更しました" />
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "変更中…" : "変更する"}
      </Button>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        退会の手続きへ
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!window.confirm("本当に退会しますか？すべての記録が消え、元に戻せません。")) e.preventDefault();
      }}
    >
      <Field label={`確認のため、ユーザーID「${username}」を入力`} htmlFor="confirm_username">
        <input id="confirm_username" name="confirm_username" autoComplete="off" required className={inputClass} />
      </Field>
      <Field label="パスワード" htmlFor="delete_password">
        <input id="delete_password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Message state={state} okText="" />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          やめる
        </Button>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "退会中…" : "退会する"}
        </Button>
      </div>
    </form>
  );
}
