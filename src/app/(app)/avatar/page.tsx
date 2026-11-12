import type { Metadata } from "next";
import { getAvatar, getUnlocks, requireProfile } from "@/lib/supabase/server";
import { AvatarEditor } from "./avatar-editor";

export const metadata: Metadata = { title: "もちを着せかえる" };

export default async function AvatarPage() {
  const me = await requireProfile();
  const [avatar, unlocks] = await Promise.all([getAvatar(me.id), getUnlocks(me.id)]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">もちを着せかえる</h1>
      <AvatarEditor initial={avatar} unlocked={unlocks} seed={me.id} username={me.username} />
    </div>
  );
}
