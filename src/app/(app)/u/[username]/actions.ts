"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { validateDisplayName } from "@/lib/validation";

export type ProfileFormState = { error?: string; saved?: boolean };

export async function updateDisplayName(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const me = await requireProfile();
  const v = validateDisplayName(String(formData.get("display_name") ?? ""));
  if (!v.ok) return { error: v.error };

  const supabase = await createClient();
  // RLS で本人の行しか更新できない。列権限で display_name 以外は更新できない
  const { error } = await supabase.from("profiles").update({ display_name: v.value }).eq("id", me.id);
  if (error) return { error: "保存できませんでした" };

  revalidatePath("/", "layout");
  return { saved: true };
}
