import type { Metadata } from "next";
import { getAvatar, getShopItems, getWallet, requireProfile } from "@/lib/supabase/server";
import { ShopView } from "./shop-view";

export const metadata: Metadata = { title: "ショップ" };

export default async function ShopPage() {
  const me = await requireProfile();
  const [avatar, wallet, items] = await Promise.all([getAvatar(me.id), getWallet(), getShopItems()]);

  return (
    <ShopView
      seed={me.id}
      avatar={avatar}
      wallet={wallet}
      items={items.filter((i) => i.currency === "coin")}
    />
  );
}
