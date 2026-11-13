import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { parseAvatar, type Avatar } from "@/lib/avatar";
import { supabaseEnv } from "@/lib/env";
import type { Profile } from "@/lib/types";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component から呼ばれた場合は書き込めない。
          // セッションの更新は proxy.ts が行うので無視してよい。
        }
      },
    },
  });
}

/** ログイン中のユーザーIDを返す。未ログインなら null */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

/** ログイン必須のページ・Server Action 用。未ログインなら /login へ */
export const requireProfile = cache(async (): Promise<Profile> => {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, created_at, bio, is_public, stats_public, weekly_goal_minutes")
    .eq("id", userId)
    .single();

  if (error || !data) redirect("/login");
  return data as Profile;
});

/** ユーザーのもちのパーツ。行がなければデフォルト */
export const getAvatar = cache(async (userId: string): Promise<Avatar> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avatars")
    .select("color, eyes, mouth, cheeks, head, neck, desk, hachimaki")
    .eq("user_id", userId)
    .maybeSingle();
  return parseAvatar(data);
});

/** 解放済みアイテムID（'desk:mug' など） */
export const getUnlocks = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("unlocks").select("item_id").eq("user_id", userId);
  return (data ?? []).map((r) => r.item_id as string);
});

export type Wallet = { coins: number; owned: string[] };

/** 自分のコインの残高と、買ったものの一覧 */
export const getWallet = cache(async (): Promise<Wallet> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_wallet");
  const w = (data ?? {}) as Partial<Wallet>;
  return { coins: typeof w.coins === "number" ? w.coins : 0, owned: Array.isArray(w.owned) ? w.owned : [] };
});

export type ShopItem = { item_id: string; kind: string; price: number; currency: "coin" | "tomato"; sort_order: number; released_at: string };

/** ショップの品物の一覧（値段は DB で管理する） */
export const getShopItems = cache(async (): Promise<ShopItem[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("shop_items").select("item_id, kind, price, currency, sort_order, released_at");
  return (data ?? []) as ShopItem[];
});
