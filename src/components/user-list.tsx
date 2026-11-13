import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { Mochi } from "@/components/mochi";
import { parseAvatar } from "@/lib/avatar";
import type { UserRow } from "@/lib/follow";

/** ユーザーの一覧（検索結果・フォロワー一覧など）。meUsername を渡すとフォローボタンを出す */
export function UserList({ users, meUsername, empty }: { users: UserRow[]; meUsername?: string; empty: string }) {
  if (users.length === 0) {
    return <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {users.map((u) => (
        <li key={u.username} className="flex items-center gap-3 rounded-3xl border border-line bg-paper p-3 shadow-sm">
          <Link href={`/u/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
            <Mochi avatar={parseAvatar(u.avatar)} size={48} seed={u.username} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{u.display_name}</span>
              <span className="block text-xs text-ink-soft">@{u.username}</span>
              {u.bio && <span className="mt-0.5 block truncate text-xs text-ink-soft">{u.bio}</span>}
            </span>
          </Link>
          {meUsername && u.username !== meUsername && u.is_following !== undefined && (
            <FollowButton username={u.username} initialFollowing={u.is_following} className="shrink-0" />
          )}
        </li>
      ))}
    </ul>
  );
}
