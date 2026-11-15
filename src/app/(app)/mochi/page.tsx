import type { Metadata } from "next";
import { requireProfile } from "@/lib/supabase/server";
import { MochiRoomPage } from "./room-page";

export const metadata: Metadata = { title: "もちの部屋" };

export default async function MyMochiRoomPage() {
  const me = await requireProfile();
  return <MochiRoomPage username={me.username} />;
}
