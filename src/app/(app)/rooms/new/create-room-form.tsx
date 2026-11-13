"use client";

import { useActionState, useState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { FREE_THEMES, ROOM_THEMES } from "@/lib/room-theme";
import { ROOM_ICONS } from "@/lib/validation";
import { createRoom, type CreateRoomState } from "./actions";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "公開", hint: "ロビーの一覧に表示されます" },
  { value: "unlisted", label: "限定", hint: "招待URLを知っている人だけ入れます" },
  { value: "approval", label: "承認制", hint: "オーナーが承認した人だけ入れます" },
] as const;

export function CreateRoomForm() {
  const [state, action, pending] = useActionState<CreateRoomState, FormData>(createRoom, {});
  const [mode, setMode] = useState<"pomodoro" | "free">("pomodoro");

  return (
    <form action={action} className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <Field label="部屋名" htmlFor="name" hint="1〜40文字">
          <input id="name" name="name" required maxLength={40} className={inputClass} placeholder="朝活もくもく会" />
        </Field>
        <Field label="説明" htmlFor="description" hint="200文字以内（任意）">
          <textarea id="description" name="description" maxLength={200} rows={3} className={inputClass} />
        </Field>
        <Field label="タグ" htmlFor="tags" hint="スペースかカンマ区切りで5個まで（例：英語 TOEIC 朝活）">
          <input id="tags" name="tags" className={inputClass} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">アイコン</legend>
          <div className="flex flex-wrap gap-2">
            {ROOM_ICONS.map((icon, i) => (
              <label key={icon} className="cursor-pointer">
                <input type="radio" name="icon" value={icon} defaultChecked={i === 0} className="peer sr-only" />
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-cream text-xl transition peer-checked:border-accent peer-checked:bg-sakura/20 peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  {icon}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">公開範囲</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {VISIBILITY_OPTIONS.map((o, i) => (
              <RadioCard key={o.value} name="visibility" value={o.value} defaultChecked={i === 0} label={o.label} hint={o.hint} />
            ))}
          </div>
        </fieldset>

        <Field label="定員" htmlFor="capacity" hint="2〜20人">
          <input id="capacity" name="capacity" type="number" min={2} max={20} defaultValue={10} required className={`${inputClass} w-28`} />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">モード</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioCard
              name="timer_mode"
              value="pomodoro"
              checked={mode === "pomodoro"}
              onChange={() => setMode("pomodoro")}
              label="🍅 ポモドーロ同期"
              hint="全員で同じタイマー。スタンプは休憩中だけ"
            />
            <RadioCard
              name="timer_mode"
              value="free"
              checked={mode === "free"}
              onChange={() => setMode("free")}
              label="🕊️ 自由"
              hint="タイマーなし。各自のペースで"
            />
          </div>
          {mode === "pomodoro" && (
            <div className="mt-3 flex flex-wrap gap-4">
              <Field label="集中（分）" htmlFor="focus_minutes" hint="5〜90">
                <input id="focus_minutes" name="focus_minutes" type="number" min={5} max={90} defaultValue={25} required className={`${inputClass} w-28`} />
              </Field>
              <Field label="休憩（分）" htmlFor="break_minutes" hint="1〜30">
                <input id="break_minutes" name="break_minutes" type="number" min={1} max={30} defaultValue={5} required className={`${inputClass} w-28`} />
              </Field>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">部屋のテーマ</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FREE_THEMES.map((value, i) => ({ value, t: ROOM_THEMES[value], i })).map(({ value, t, i }) => (
              <RadioCard key={value} name="theme" value={value} defaultChecked={i === 0} label={`${t.icon} ${t.label}`} hint="" />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">寿命</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioCard name="lifetime" value="persistent" defaultChecked label="常設" hint="ずっと残ります" />
            <RadioCard name="lifetime" value="temporary" label="一時" hint="最後の1人が退室したら閉じます" />
          </div>
        </fieldset>
      </Card>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "作成中…" : "部屋をつくる"}
      </Button>
    </form>
  );
}

function RadioCard({
  label,
  hint,
  ...input
}: React.ComponentProps<"input"> & { label: string; hint: string }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" className="peer sr-only" {...input} />
      <span className="flex h-full flex-col gap-0.5 rounded-2xl border border-line bg-cream px-3 py-2 transition peer-checked:border-accent peer-checked:bg-sakura/15 peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-xs text-ink-soft">{hint}</span>
      </span>
    </label>
  );
}
