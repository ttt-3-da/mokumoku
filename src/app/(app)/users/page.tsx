import type { Metadata } from "next";
import Link from "next/link";
import { Mochi } from "@/components/mochi";
import { Button, inputClass } from "@/components/ui";
import { parseAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ユーザーをさがす" };

type Hit = { username: string; display_name: string; bio: string; avatar: unknown };

/** ユーザー検索（プロフィールを公開している人だけ出る） */
export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 30) : "";

  let hits: Hit[] = [];
  if (query) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("search_users", { p_query: query });
    hits = (data ?? []) as Hit[];
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
      ) : hits.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          「{query}」に当てはまるユーザーは見つかりませんでした。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {hits.map((u) => (
            <li key={u.username}>
              <Link
                href={`/u/${u.username}`}
                className="flex items-center gap-3 rounded-3xl border border-line bg-paper p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Mochi avatar={parseAvatar(u.avatar)} size={48} seed={u.username} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{u.display_name}</span>
                  <span className="block text-xs text-ink-soft">@{u.username}</span>
                  {u.bio && <span className="mt-0.5 block truncate text-xs text-ink-soft">{u.bio}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
