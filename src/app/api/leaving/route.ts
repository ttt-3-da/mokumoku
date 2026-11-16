import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 部屋の画面を閉じるときに navigator.sendBeacon で呼ばれる（ログインの Cookie つき）。
 * 30秒たってもハートビートが来なければ、サーバーの後処理がそのまま退室にする。
 */
export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_leaving");
  return new NextResponse(null, { status: error ? 400 : 204 });
}
