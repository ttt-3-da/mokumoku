import Link from "next/link";
import { UserList } from "@/components/user-list";
import { parseAvatar } from "@/lib/avatar";
import type { UserRow } from "@/lib/follow";
import { createClient, requireProfile } from "@/lib/supabase/server";

/** フォロワー一覧・フォロー中一覧の共通の中身 */
export async function FollowListPage({ username, kind }: { username: string; kind: "followers" | "following" }) {
  const me = await requireProfile();
  const supabase = await createClient();
  const name = username.toLowerCase();
  const { data } = await supabase.rpc("list_follows", { p_username: name, p_kind: kind });
  const users = ((data ?? []) as UserRow[]).map((u) => ({ ...u, avatar: parseAvatar(u.avatar) }));
  const tab = (k: "followers" | "following", label: string) => (
    <Link
      href={`/u/${name}/${k}`}
      aria-current={k === kind ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-sm ${k === kind ? "bg-ink font-bold text-paper" : "bg-paper hover:bg-sakura/20"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Link href={`/u/${name}`} className="text-sm text-ink-soft hover:underline">
        ← @{name} のプロフィール
      </Link>
      <div className="flex gap-2">
        {tab("followers", "フォロワー")}
        {tab("following", "フォロー中")}
      </div>
      <UserList
        users={users}
        meUsername={me.username}
        empty={kind === "followers" ? "まだフォロワーはいません。" : "まだだれもフォローしていません。"}
      />
      <p className="text-xs text-ink-soft">プロフィールを非公開にしている人は表示されません。</p>
    </div>
  );
}
