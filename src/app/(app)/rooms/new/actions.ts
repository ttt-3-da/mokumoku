"use server";

import { redirect } from "next/navigation";
import { rpcErrorMessage } from "@/lib/errors";
import { parseTheme } from "@/lib/room-theme";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { validateRoomInput } from "@/lib/validation";

export type CreateRoomState = { error?: string };

export async function createRoom(_prev: CreateRoomState, formData: FormData): Promise<CreateRoomState> {
  const me = await requireProfile();
  const get = (k: string) => String(formData.get(k) ?? "");

  const v = validateRoomInput({
    name: get("name"),
    description: get("description"),
    icon: get("icon"),
    tags: get("tags"),
    visibility: get("visibility"),
    capacity: get("capacity"),
    timer_mode: get("timer_mode"),
    focus_minutes: get("focus_minutes"),
    break_minutes: get("break_minutes"),
    is_persistent: get("lifetime") !== "temporary",
  });
  if (!v.ok) return { error: v.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .insert({ ...v.value, theme: parseTheme(get("theme")), owner_id: me.id })
    .select("id")
    .single();

  if (error?.message === "ng_word" || error?.message === "theme_locked") return { error: rpcErrorMessage(error) };
  if (error || !data) return { error: "部屋を作成できませんでした" };
  redirect(`/rooms/${data.id}`);
}
