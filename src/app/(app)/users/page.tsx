import type { Metadata } from "next";
import { UserList } from "@/components/user-list";
import { Button, inputClass } from "@/components/ui";
import { parseAvatar } from "@/lib/avatar";
import type { UserRow } from "@/lib/follow";
import { createClient, requireProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ユーザーをさがす" };



/** ユーザー検索（プロフィールを公開している人だけ出る） */
export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 30) : "";

  const me = await requireProfile();
  let hits: UserRow[] = [];
  if (query) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("search_users", { p_query: query });
    hits = ((data ?? []) as UserRow[]).map((u) => ({ ...u, avatar: parseAvatar(u.avatar) }));
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-bold">ユーザーをさがす</h1>
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          ユーザーIDか表示名
        </label>
        <input id="q" name="q" defaultValue={query} maxLength={30} placeholder="ユーザーIDか表示名" className={`${inputClass} min-w-0 flex-1`} />
        <Button type="submit" className="shrink-0">
          検索
        </Button>
      </form>

      {!query ? (
        <p className="text-sm text-ink-soft">ユーザーIDか表示名の一部を入れて検索してください。プロフィールを非公開にしている人は出てきません。</p>
      ) : (
        <UserList users={hits} meUsername={me.username} empty={`「${query}」に当てはまるユーザーは見つかりませんでした。`} />
      )}
    </div>
  );
}
