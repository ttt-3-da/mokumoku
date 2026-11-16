import type { Metadata } from "next";
import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { Mochi } from "@/components/mochi";
import { parseAvatar } from "@/lib/avatar";
import { BADGES, isBadgeId } from "@/lib/badges";
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
  const items = ((data ?? []) as NotificationRow[]).map((n) => ({ ...n, actor_avatar: n.actor_avatar ? parseAvatar(n.actor_avatar) : null }));
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
              <NotificationBody n={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function When({ n }: { n: NotificationRow }) {
  return (
    <time dateTime={n.created_at} className="block text-xs text-ink-soft">
      {fmt.format(new Date(n.created_at))}
      {!n.read_at && <span className="ml-2 font-bold text-accent-strong">NEW</span>}
    </time>
  );
}

function NotificationBody({ n }: { n: NotificationRow }) {
  if (n.kind === "badge") {
    const b = isBadgeId(n.detail) ? BADGES[n.detail] : null;
    return (
      <>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-3xl" aria-hidden>
          {b?.icon ?? "🏅"}
        </span>
        <p className="min-w-0 flex-1 text-sm">
          実績バッジ「<b>{b?.name ?? "？"}</b>」を手に入れました{b && b.coins > 0 && `（🪙+${b.coins}）`}
          {b && <span className="block text-xs text-ink-soft">{b.desc}</span>}
          <When n={n} />
        </p>
      </>
    );
  }
  if (n.kind === "schedule") {
    return (
      <>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-3xl" aria-hidden>
          {n.room_icon ?? "⏰"}
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <Link href={`/rooms/${n.room_id}`} className="font-bold hover:underline">
            {n.room_name}
          </Link>{" "}
          の定例が30分後に始まります
          <When n={n} />
        </p>
      </>
    );
  }
  if (!n.actor_username || !n.actor_avatar) return null;
  if (n.kind === "mochi_stamp") {
    return (
      <>
        <Link href={`/u/${n.actor_username}`} className="shrink-0">
          <Mochi avatar={n.actor_avatar} size={44} seed={n.actor_username} />
        </Link>
        <p className="min-w-0 flex-1 text-sm">
          <Link href={`/u/${n.actor_username}`} className="font-bold hover:underline">
            {n.actor_display_name}
          </Link>{" "}
          さんが
          <Link href="/mochi" className="font-bold hover:underline">
            もちの部屋
          </Link>
          にスタンプを置いていきました
          <When n={n} />
        </p>
      </>
    );
  }
  return (
    <>
      <Link href={`/u/${n.actor_username}`} className="shrink-0">
        <Mochi avatar={n.actor_avatar} size={44} seed={n.actor_username} />
      </Link>
      <p className="min-w-0 flex-1 text-sm">
        <Link href={`/u/${n.actor_username}`} className="font-bold hover:underline">
          {n.actor_display_name}
        </Link>{" "}
        さんがあなたをフォローしました
        <When n={n} />
      </p>
      <FollowButton username={n.actor_username} initialFollowing={n.is_following} followsMe className="shrink-0" />
    </>
  );
}
