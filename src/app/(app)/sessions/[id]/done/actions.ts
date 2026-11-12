"use server";

import { redirect } from "next/navigation";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { validateNote } from "@/lib/validation";

export type NoteState = { error?: string };

/** 退室した記録に、自分だけのメモを付ける（空でもよい） */
export async function saveNote(sessionId: string, _prev: NoteState, formData: FormData): Promise<NoteState> {
  await requireProfile();
  const note = validateNote(String(formData.get("note") ?? ""));
  if (!note.ok) return { error: note.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_session_note", { p_session_id: sessionId, p_note: note.value });
  if (error) return { error: rpcErrorMessage(error) };

  redirect("/timeline");
}
