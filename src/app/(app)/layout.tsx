import Link from "next/link";
import { headers } from "next/headers";
import { formatCoins } from "@/lib/shop";
import { createClient, getWallet, requireProfile } from "@/lib/supabase/server";
import { AccountMenu, MobileMenu, NavLinks } from "./nav-links";
import { ReturnToRoom } from "./return-to-room";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const supabase = await createClient();
  // アクセスした国を記録する（IP は記録しない。Vercel が付けるヘッダーから国だけ読む）
  const country = (await headers()).get("x-vercel-ip-country");
  const [{ data: unread }] = await Promise.all([
    supabase.rpc("count_unread_notifications"),
    supabase.rpc("touch_access", { p_country: country ?? "" }),
  ]);
  const unreadCount = typeof unread === "number" ? unread : 0;
  const wallet = await getWallet();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        {/* スマホ（縦持ち）では ☰ から左にメニューを出す */}
        <div className="mx-auto flex max-w-5xl items-center gap-x-3 px-4 py-2 sm:gap-x-4 sm:py-3">
          <MobileMenu username={profile.username} isAdmin={Boolean(profile.is_admin)} />
          <Link href="/lobby" className="text-lg font-bold tracking-wide">
            Mokumoku
          </Link>
          <NavLinks />
          <Link
            href="/shop"
            data-tour="coins"
            className="ml-auto shrink-0 rounded-full bg-paper px-2.5 py-1 text-sm font-bold tabular-nums shadow-sm hover:bg-sakura/20"
            aria-label={`所持コイン ${formatCoins(wallet.coins)}枚（ショップへ）`}
          >
            🪙 {formatCoins(wallet.coins)}
          </Link>
          <Link
            href="/notifications"
            className="relative shrink-0 rounded-full px-2.5 py-1.5 text-sm text-ink-soft hover:bg-paper hover:text-ink"
            aria-label={unreadCount > 0 ? `お知らせ（未読${unreadCount}件）` : "お知らせ"}
          >
            📬
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent-strong px-1 text-center text-[10px] font-bold leading-4 text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <AccountMenu username={profile.username} isAdmin={Boolean(profile.is_admin)} />
        </div>
        <ReturnToRoom userId={profile.id} />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
