"use client";

import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import { updateDisplayName, type ProfileFormState } from "./actions";

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateDisplayName, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="display_name" className="sr-only">
        表示名
      </label>
      <input
        id="display_name"
        name="display_name"
        defaultValue={current}
        maxLength={30}
        required
        className={inputClass}
      />
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending ? "保存中…" : "保存"}
      </Button>
      <p aria-live="polite" className={`text-sm sm:self-center ${state.error ? "text-red-600" : "text-yomogi"}`}>
        {state.error ?? (state.saved ? "保存しました" : "")}
      </p>
    </form>
  );
}
