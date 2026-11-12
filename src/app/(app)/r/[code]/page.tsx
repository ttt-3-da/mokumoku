import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient, requireProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "招待" };

const CODE_RE = /^[A-Za-z0-9_-]{6,32}$/;

/**
 * 招待URL `/r/{invite_code}`。部屋を引いて入室前画面へ直接移動する。
 * 未ログインなら proxy.ts がログイン画面に送り、ログイン後にここへ戻ってくる。
 */
export default async function InvitePage({ params }: PageProps<"/r/[code]">) {
  const { code } = await params;
  if (!CODE_RE.test(code)) notFound();

  await requireProfile();
  const supabase = await createClient();
  const { data: roomId } = await supabase.rpc("get_room_by_invite", { p_invite_code: code });
  if (!roomId) notFound();

  redirect(`/rooms/${roomId as string}?invite=${encodeURIComponent(code)}`);
}
