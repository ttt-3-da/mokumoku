import { notFound } from "next/navigation";
import { MochiRoom } from "@/components/mochi-room";
import { parseAvatar } from "@/lib/avatar";
import { isWallpaper, parsePlacedItems } from "@/lib/mochi-room";
import { createClient, getWallet } from "@/lib/supabase/server";

/** 自分の部屋・ほかの人の部屋の両方で使う */
export async function MochiRoomPage({ username }: { username: string }) {
  const supabase = await createClient();
  const [{ data }, wallet] = await Promise.all([supabase.rpc("get_mochi_room", { p_username: username }), getWallet()]);
  if (!data) notFound();
  const room = data as { user_id: string; display_name: string; is_me: boolean; wallpaper: string; items: unknown; avatar: unknown };
  return (
    <MochiRoom
      avatar={parseAvatar(room.avatar)}
      seed={room.user_id}
      displayName={room.display_name}
      isMe={room.is_me}
      wallpaper={isWallpaper(room.wallpaper) ? room.wallpaper : "cream"}
      items={parsePlacedItems(room.items)}
      owned={room.is_me ? wallet.owned : []}
    />
  );
}
