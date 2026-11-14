"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 入室したままほかのページを見ているとき（休憩中など）に、部屋へ戻るリンクを出す。
 * レイアウトはページを移っても描き直されないので、ページが変わるたびに確かめる
 */
export function ReturnToRoom({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [room, setRoom] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (pathname.endsWith("/live")) return;
    let alive = true;
    void createClient()
      .from("study_sessions")
      .select("room_id, rooms(name)")
      .eq("user_id", userId)
      .is("ended_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const d = data as { room_id: string; rooms: { name: string } | null } | null;
        setRoom(d ? { id: d.room_id, name: d.rooms?.name ?? "部屋" } : null);
      });
    return () => {
      alive = false;
    };
  }, [pathname, userId]);

  if (!room || pathname.endsWith("/live")) return null;
  return (
    <div className="border-b border-line bg-kinako/30">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-sm">
        <span className="min-w-0 truncate">☕ 「{room.name}」に入室中です（休憩が終わるまでに戻ってね）</span>
        <Link href={`/rooms/${room.id}/live`} className="ml-auto shrink-0 rounded-full bg-paper px-3 py-0.5 font-bold shadow-sm hover:bg-sakura/20">
          部屋に戻る
        </Link>
      </div>
    </div>
  );
}
