import { notFound } from "next/navigation";
import type { RoomStamp } from "@/components/mochi-room-stamps";
import { MochiRoom } from "@/components/mochi-room";
import { parseAvatar } from "@/lib/avatar";
import { isWallpaper, parsePlacedItems } from "@/lib/mochi-room";
import { isStampId } from "@/lib/stamps";
import { createClient, getAvatar, getWallet, requireProfile } from "@/lib/supabase/server";

type RawStamp = Omit<RoomStamp, "sender_avatar" | "x" | "y"> & { x: number | string; y: number | string; sender_avatar: unknown };

/** 自分の部屋・ほかの人の部屋の両方で使う */
export async function MochiRoomPage({ username }: { username: string }) {
  const me = await requireProfile();
  const supabase = await createClient();
  const [{ data }, wallet, myAvatar] = await Promise.all([supabase.rpc("get_mochi_room", { p_username: username }), getWallet(), getAvatar(me.id)]);
  if (!data) notFound();
  const room = data as {
    user_id: string;
    username: string;
    display_name: string;
    is_me: boolean;
    wallpaper: string;
    items: unknown;
    avatar: unknown;
    stamps?: RawStamp[];
  };
  const stamps: RoomStamp[] = (room.stamps ?? [])
    .filter((s) => isStampId(s.stamp_id))
    .map((s) => ({ ...s, x: Number(s.x), y: Number(s.y), sender_avatar: parseAvatar(s.sender_avatar) }));
  return (
    <MochiRoom
      avatar={parseAvatar(room.avatar)}
      seed={room.user_id}
      username={room.username}
      displayName={room.display_name}
      isMe={room.is_me}
      wallpaper={isWallpaper(room.wallpaper) ? room.wallpaper : "cream"}
      items={parsePlacedItems(room.items)}
      owned={wallet.owned}
      stamps={stamps}
      visitor={{ avatar: myAvatar, isPublic: me.is_public }}
    />
  );
}
