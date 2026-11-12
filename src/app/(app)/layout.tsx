import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/lobby" className="text-lg font-bold tracking-wide">
            Mokumoku
          </Link>
          <NavLinks username={profile.username} />
          <form action={signOut} className="ml-auto">
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
