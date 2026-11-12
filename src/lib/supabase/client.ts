import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

/** ブラウザ用のクライアント（シングルトン）。Realtime と RPC に使う */
export function createClient(): SupabaseClient {
  if (!browserClient) {
    const { url, key } = supabaseEnv();
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
