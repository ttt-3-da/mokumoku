"use server";

import { redirect } from "next/navigation";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { validateTask } from "@/lib/validation";

export type EnterState = { error?: string; pending?: boolean };

export async function enterRoom(
  roomId: string,
  inviteCode: string | null,
  _prev: EnterState,
  formData: FormData,
): Promise<EnterState> {
  await requireProfile();
  const task = validateTask(String(formData.get("task") ?? ""));
  if (!task.ok) return { error: task.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enter_room", {
    p_room_id: roomId,
    p_task: task.value,
    p_invite_code: inviteCode,
  });
  if (error) return { error: rpcErrorMessage(error) };

  const result = data as { status: "entered" | "pending" };
  if (result.status === "pending") return { pending: true };

  redirect(`/rooms/${roomId}/live`);
}
