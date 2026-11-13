import Link from "next/link";
import { createClient, getWallet, requireProfile } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const { data: unread } = await (await createClient()).rpc("count_unread_notifications");
  const unreadCount = typeof unread === "number" ? unread : 0;
  const wallet = await getWallet();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        {/* スマホではメニューを2行目に回して、横にはみ出さないようにする */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/lobby" className="text-lg font-bold tracking-wide">
            Mokumoku
          </Link>
          <NavLinks username={profile.username} />
          <Link
            href="/shop"
            className="ml-auto shrink-0 rounded-full bg-paper px-2.5 py-1 text-sm font-bold tabular-nums shadow-sm hover:bg-sakura/20"
            aria-label={`所持コイン ${wallet.coins}枚（ショップへ）`}
          >
            🪙 {wallet.coins}
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
          <form action={signOut} className="shrink-0">
            <button type="submit" className="text-sm text-ink-soft hover:text-ink">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
