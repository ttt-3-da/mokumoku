import type { Metadata } from "next";
import Link from "next/link";
import { parseFeedTab, type Post } from "@/lib/posts";
import { createClient, getAvatar, requireProfile } from "@/lib/supabase/server";
import { FeedList } from "./feed-list";

export const metadata: Metadata = { title: "みんなの記録" };

const PAGE_SIZE = 20;

/** みんなが投稿した勉強の記録。もちスタンプで応援できる */
export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const tab = parseFeedTab((await searchParams).tab);
  const me = await requireProfile();
  const supabase = await createClient();
  const [{ data, error }, avatar] = await Promise.all([
    supabase.rpc("list_posts", { p_tab: tab, p_limit: PAGE_SIZE }),
    getAvatar(me.id),
  ]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">みんなの記録</h1>
        <p className="mt-1 text-xs text-ink-soft">退室したあとの「おつかれさま」の画面から、自分の勉強を投稿できます。もちスタンプで応援しよう。</p>
      </div>
      <nav className="flex gap-2" aria-label="タブ">
        {(
          [
            ["following", "フォロー中"],
            ["all", "みんな"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? "/feed?tab=all" : "/feed"}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === key ? "bg-accent text-white" : "bg-paper text-ink-soft hover:bg-cream"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {error ? (
        <p className="text-sm text-red-600">読み込めませんでした。</p>
      ) : (
        <FeedList key={tab} tab={tab} initial={(data ?? []) as Post[]} pageSize={PAGE_SIZE} myAvatar={avatar} isAdmin={Boolean(me.is_admin)} />
      )}
    </div>
  );
}
