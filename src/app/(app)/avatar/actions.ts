"use server";

import { revalidatePath } from "next/cache";
import { parseAvatar, type Avatar } from "@/lib/avatar";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient, requireProfile } from "@/lib/supabase/server";

export async function saveAvatar(input: Avatar): Promise<{ error?: string; avatar?: Avatar }> {
  const me = await requireProfile();
  const a = parseAvatar(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_avatar", {
    p_color: a.color,
    p_eyes: a.eyes,
    p_mouth: a.mouth,
    p_cheeks: a.cheeks,
    p_head: a.head,
    p_desk: a.desk,
    p_hachimaki: a.hachimaki,
    p_neck: a.neck,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/u/${me.username}`);
  return { avatar: parseAvatar(data) };
}
