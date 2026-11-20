import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 部屋の画面のタブが見えなくなったときに navigator.sendBeacon で呼ばれる（ログインの Cookie つき）。
 * 見えていない間はブラウザがハートビートを止めることがあるので、サーバーは「通信切れ」で退室にせず待つ。
 */
export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_hidden");
  return new NextResponse(null, { status: error ? 400 : 204 });
}
