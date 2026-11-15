import type { Metadata } from "next";
import { MochiRoomPage } from "@/app/(app)/mochi/room-page";

export const metadata: Metadata = { title: "もちの部屋" };

export default async function UserMochiRoomPage({ params }: PageProps<"/u/[username]/mochi">) {
  const { username } = await params;
  return <MochiRoomPage username={decodeURIComponent(username)} />;
}
