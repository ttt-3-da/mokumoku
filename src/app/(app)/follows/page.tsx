import type { Metadata } from "next";
import Link from "next/link";
import { FollowingActivity } from "@/components/following-activity";
import { Mochi } from "@/components/mochi";
import { ButtonLink, Card } from "@/components/ui";
import { parseAvatar } from "@/lib/avatar";
import { barPercent, type FollowingActivity as Activity, type LeaderRow } from "@/lib/follow";
import { formatMinutes } from "@/lib/pomodoro";
import { createClient, requireProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "フォロー" };

/** フォロー中の人：いま勉強中の人と、今週の学習時間くらべ */
export default async function FollowsPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const [{ data: activityData }, { data: boardData }] = await Promise.all([
    supabase.rpc("list_following_activity"),
    supabase.rpc("follow_leaderboard"),
  ]);
  const activity = ((activityData ?? []) as Activity[]).map((a) => ({ ...a, avatar: parseAvatar(a.avatar) }));
  const board = ((boardData ?? []) as LeaderRow[]).map((r) => ({ ...r, avatar: parseAvatar(r.avatar) }));
  const max = Math.max(0, ...board.map((r) => r.week_minutes));
  const onlyMe = board.length <= 1;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">フォロー</h1>
        <Link href={`/u/${me.username}/following`} className="ml-auto text-sm text-ink-soft hover:underline">
          フォロー中の一覧 →
        </Link>
      </div>

      <section aria-labelledby="now">
        <h2 id="now" className="mb-3 font-bold">
          いま勉強中
        </h2>
        {activity.length > 0 ? (
          <FollowingActivity items={activity} />
        ) : (
          <p className="text-sm text-ink-soft">いま勉強中のフォロー中の人はいません。</p>
        )}
      </section>

      <Card>
        <h2 className="font-bold">今週の学習時間をくらべる</h2>
        <p className="mb-4 text-xs text-ink-soft">月曜から今日まで（日本時間）。学習の統計を公開している人だけが出ます。</p>
        {onlyMe ? (
          <div className="flex flex-col items-start gap-3 text-sm text-ink-soft">
            <p>まだくらべる相手がいません。気になる人をフォローしてみましょう。</p>
            <ButtonLink href="/users" variant="secondary">
              ユーザーをさがす
            </ButtonLink>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {board.map((r, i) => (
              <li
                key={r.username}
                className={`grid grid-cols-[1.5rem_2.5rem_minmax(0,7rem)_1fr_auto] items-center gap-2 rounded-2xl px-2 py-1.5 ${r.is_me ? "bg-sakura/15" : ""}`}
                title={`${r.display_name}：${formatMinutes(r.week_minutes)}`}
              >
                <span className="text-center text-sm font-bold tabular-nums text-ink-soft">{i + 1}</span>
                <Mochi avatar={r.avatar} size={36} seed={r.username} />
                <Link href={`/u/${r.username}`} className="truncate text-sm font-bold hover:underline">
                  {r.display_name}
                  {r.is_me && <span className="ml-1 text-xs font-normal text-accent-strong">（あなた）</span>}
                </Link>
                <span className="h-3 overflow-hidden rounded-full bg-cream" aria-hidden>
                  <span className="block h-full rounded-full bg-yomogi" style={{ width: `${barPercent(r.week_minutes, max)}%` }} />
                </span>
                <span className="w-20 text-right text-sm tabular-nums">{formatMinutes(r.week_minutes)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
