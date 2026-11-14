import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient, getAvatar, getWallet, requireProfile } from "@/lib/supabase/server";
import { plantLevel } from "@/lib/room-theme";
import type { Room, StudySession } from "@/lib/types";
import { RoomLive } from "./room-live";

export const metadata: Metadata = { title: "自習中" };

export default async function RoomLivePage({ params }: PageProps<"/rooms/[id]/live">) {
  const { id } = await params;
  const me = await requireProfile();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", me.id)
    .eq("room_id", id)
    .is("ended_at", null)
    .maybeSingle();

  // 入室していない（または別の部屋に移った）なら入室前画面へ
  if (!session) redirect(`/rooms/${id}`);

  const [{ data: room }, { data: membership }, avatar, { data: stats }, wallet] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", id).maybeSingle(),
    supabase.from("room_members").select("role, status").eq("room_id", id).eq("user_id", me.id).maybeSingle(),
    getAvatar(me.id),
    supabase.rpc("get_profile_stats", { p_username: me.username }),
    getWallet(),
  ]);
  if (!room) notFound();

  const isStaff =
    room.owner_id === me.id ||
    (membership?.status === "active" && (membership.role === "owner" || membership.role === "moderator"));

  return (
    <RoomLive
      room={room as Room}
      session={session as StudySession}
      me={{ id: me.id, displayName: me.display_name, avatar, plantLevel: plantLevel((stats as { total_minutes?: number } | null)?.total_minutes ?? 0) }}
      isStaff={isStaff}
      owned={wallet.owned}
    />
  );
}
