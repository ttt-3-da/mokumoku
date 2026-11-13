"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** お知らせを表示したら既読にして、ヘッダーの未読の数を取り直す */
export function MarkRead() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void createClient()
      .rpc("mark_notifications_read")
      .then(() => {
        if (!cancelled) router.refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
