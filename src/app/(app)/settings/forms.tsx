"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { COLOR_SCHEME_KEY, COLOR_SCHEME_LABEL, parseColorScheme, type ColorSchemePref } from "@/lib/color-scheme";
import { GOAL_HOURS_MAX, GOAL_HOURS_MIN } from "@/lib/goals";
import { BIO_MAX, charLength } from "@/lib/validation";
import { OFFLINE_LEAVE_CHOICES } from "@/lib/offline-leave";
import { changePassword, deleteAccount, updateGoal, updateOfflineLeave, updateProfile, updateVisibility, type FormState } from "./actions";

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

/** 見た目のモード。このブラウザだけに保存する */
export function ColorSchemeForm() {
  const [pref, setPref] = useState<ColorSchemePref>("auto");

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setPref(parseColorScheme(localStorage.getItem(COLOR_SCHEME_KEY)));
      } catch {
        // 読めなければ自動のまま
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function change(v: ColorSchemePref) {
    setPref(v);
    try {
      if (v === "auto") localStorage.removeItem(COLOR_SCHEME_KEY);
      else localStorage.setItem(COLOR_SCHEME_KEY, v);
    } catch {
      // 保存できなくても、この画面の間は切り替える
    }
    const apply = (window as { __applyColorScheme?: () => void }).__applyColorScheme;
    if (apply) apply();
    else document.documentElement.setAttribute("data-theme", v === "dark" ? "dark" : "light");
  }

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">見た目のモード</legend>
      {(Object.keys(COLOR_SCHEME_LABEL) as ColorSchemePref[]).map((v) => (
        <label
          key={v}
          className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${pref === v ? "border-accent bg-sakura/20 font-bold" : "border-line bg-paper hover:bg-cream"}`}
        >
          <input type="radio" name="color_scheme" value={v} checked={pref === v} onChange={() => change(v)} className="sr-only" />
          {COLOR_SCHEME_LABEL[v]}
        </label>
      ))}
    </fieldset>
  );
}

/** 週の目標（時間） */
export function GoalForm({ goalMinutes }: { goalMinutes: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateGoal, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="1週間の勉強時間" htmlFor="weekly_goal" hint={`${GOAL_HOURS_MIN}〜${GOAL_HOURS_MAX}時間。空にすると目標なし。達成すると 🪙20（週に1回）`}>
        <div className="flex items-center gap-2">
          <input
            id="weekly_goal"
            name="weekly_goal"
            type="number"
            inputMode="decimal"
            min={GOAL_HOURS_MIN}
            max={GOAL_HOURS_MAX}
            step={0.5}
            defaultValue={goalMinutes === null ? "" : goalMinutes / 60}
            placeholder="例：10"
            className={`${inputClass} max-w-32`}
          />
          <span className="text-sm">時間 / 週</span>
        </div>
      </Field>
      <Message state={state} okText="保存しました" />
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "保存中…" : "保存する"}
      </Button>
    </form>
  );
}

export function OfflineLeaveForm({ minutes }: { minutes: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateOfflineLeave, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="退室になるまでの時間" htmlFor="offline_leave_minutes" hint="記録は、最後に画面とつながっていた時刻までになります">
        <select id="offline_leave_minutes" name="offline_leave_minutes" defaultValue={minutes} className={`${inputClass} max-w-40`}>
          {OFFLINE_LEAVE_CHOICES.map((m) => (
            <option key={m} value={m}>
              {m}分
            </option>
          ))}
        </select>
      </Field>
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
