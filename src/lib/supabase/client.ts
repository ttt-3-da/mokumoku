import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

/** ブラウザ用のクライアント（シングルトン）。Realtime と RPC に使う */
export function createClient(): SupabaseClient {
  if (!browserClient) {
    const { url, key } = supabaseEnv();
    browserClient = createBrowserClient(url, key, {
      // 見ていないタブではブラウザがタイマーを間引くため、Realtime の生存確認（heartbeat）が遅れて
      // 接続が切れ、ほかの人の画面から自分が消えてしまう。Web Worker で送れば間引かれにくい。
      realtime: { worker: true },
    });
  }
  return browserClient;
}
