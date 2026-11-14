import type { Metadata } from "next";
import { signOut } from "@/app/login/actions";
import { Mochi } from "@/components/mochi";

export const metadata: Metadata = { title: "利用停止中" };

/** 管理者に利用停止にされた人が開くページ（ほかのページからここへ移される） */
export default function SuspendedPage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Mochi size={96} seed="suspended" state="away" />
      <h1 className="text-xl font-bold">このアカウントは利用停止中です</h1>
      <p className="text-sm text-ink-soft">利用規約に反する使い方があったため、運営がこのアカウントの利用を止めています。</p>
      <form action={signOut}>
        <button type="submit" className="rounded-full border border-line bg-paper px-5 py-2 text-sm font-bold hover:bg-cream">
          ログアウト
        </button>
      </form>
    </main>
  );
}
