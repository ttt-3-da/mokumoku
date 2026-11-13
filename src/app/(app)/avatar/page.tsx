import type { Metadata } from "next";
import { getAvatar, getShopItems, getUnlocks, getWallet, requireProfile } from "@/lib/supabase/server";
import { AvatarEditor } from "./avatar-editor";

export const metadata: Metadata = { title: "もちを着せかえる" };

export default async function AvatarPage() {
  const me = await requireProfile();
  const [avatar, unlocks, wallet, items] = await Promise.all([getAvatar(me.id), getUnlocks(me.id), getWallet(), getShopItems()]);
  const prices = Object.fromEntries(items.filter((i) => i.currency === "coin").map((i) => [i.item_id, i.price]));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">もちを着せかえる</h1>
      <AvatarEditor initial={avatar} unlocked={unlocks} owned={wallet.owned} prices={prices} seed={me.id} username={me.username} />
    </div>
  );
}
