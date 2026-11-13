import type { Metadata } from "next";
import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { Mochi } from "@/components/mochi";
import { parseAvatar } from "@/lib/avatar";
import type { NotificationRow } from "@/lib/follow";
import { createClient } from "@/lib/supabase/server";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "お知らせ" };

const fmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_notifications");
  const items = ((data ?? []) as NotificationRow[]).map((n) => ({ ...n, actor_avatar: parseAvatar(n.actor_avatar) }));
  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-bold">お知らせ</h1>
      {/* 開いたら既読にする（ヘッダーの数も消える） */}
      {hasUnread && <MarkRead />}
      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">お知らせはまだありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-center gap-3 rounded-3xl border p-3 shadow-sm ${n.read_at ? "border-line bg-paper" : "border-accent bg-sakura/10"}`}
            >
              <Link href={`/u/${n.actor_username}`} className="shrink-0">
                <Mochi avatar={n.actor_avatar} size={44} seed={n.actor_username} />
              </Link>
              <p className="min-w-0 flex-1 text-sm">
                <Link href={`/u/${n.actor_username}`} className="font-bold hover:underline">
                  {n.actor_display_name}
                </Link>{" "}
                さんがあなたをフォローしました
                <time dateTime={n.created_at} className="block text-xs text-ink-soft">
                  {fmt.format(new Date(n.created_at))}
                  {!n.read_at && <span className="ml-2 font-bold text-accent-strong">NEW</span>}
                </time>
              </p>
              <FollowButton username={n.actor_username} initialFollowing={n.is_following} followsMe className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
