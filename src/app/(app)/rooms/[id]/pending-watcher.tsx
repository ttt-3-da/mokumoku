"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 承認待ちの間、15秒ごとに画面を取り直す（承認されたら入室フォームが出る） */
export function PendingWatcher() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
