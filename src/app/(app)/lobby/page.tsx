import type { Metadata } from "next";
import Link from "next/link";
import { FollowingActivity } from "@/components/following-activity";
import { LastWeekCard, UpcomingSchedules, type UpcomingSchedule } from "@/components/lobby-extras";
import { WeeklyGoalBar } from "@/components/weekly-goal";
import { isMondayInJapan, parseLastWeekSummary, parseWeeklyProgress } from "@/lib/goals";
import { RoomCard } from "@/components/room-card";
import { parseAvatar } from "@/lib/avatar";
import type { FollowingActivity as FollowingActivityRow } from "@/lib/follow";
import { ButtonLink, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { RoomCard as RoomCardData } from "@/lib/types";

export const metadata: Metadata = { title: "ロビー" };

function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function LobbyPage({ searchParams }: PageProps<"/lobby">) {
  const sp = await searchParams;
  const q = param(sp.q).slice(0, 40);
  const tag = param(sp.tag).slice(0, 15);

  const supabase = await createClient();
  const now = new Date();
  const monday = isMondayInJapan(now);
  const [publicRes, mineRes, activityRes, progressRes, upcomingRes, summaryRes] = await Promise.all([
    supabase.rpc("list_public_rooms", { p_query: q || null, p_tag: tag || null }),
    supabase.rpc("list_my_rooms"),
    supabase.rpc("list_following_activity"),
    supabase.rpc("get_weekly_progress"),
    supabase.rpc("list_upcoming_schedules"),
    monday ? supabase.rpc("last_week_summary") : Promise.resolve({ data: null }),
  ]);
  const progress = parseWeeklyProgress(progressRes.data);
  const upcoming = (upcomingRes.data ?? []) as UpcomingSchedule[];
  const summary = parseLastWeekSummary(summaryRes.data);
  const activity = ((activityRes.data ?? []) as FollowingActivityRow[]).map((a) => ({ ...a, avatar: parseAvatar(a.avatar) }));

  const publicRooms = (publicRes.data ?? []) as RoomCardData[];
  const myRooms = (mineRes.data ?? []) as RoomCardData[];
  const filtering = Boolean(q || tag);

  // 表示中の公開部屋から、よく使われているタグを集めて絞り込み候補にする
  const tagCounts = new Map<string, number>();
  for (const r of publicRooms) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const popularTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">ロビー</h1>
        <ButtonLink href="/rooms/new" className="ml-auto">
          ＋ 部屋をつくる
        </ButtonLink>
      </div>

      {!filtering && progress && <WeeklyGoalBar progress={progress} isMe />}
      {!filtering && summary && <LastWeekCard summary={summary} />}
      {!filtering && upcoming.length > 0 && <UpcomingSchedules items={upcoming} now={now.getTime()} />}

      <form role="search" className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            部屋を検索
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="部屋名・説明で検索" className={inputClass} />
          {tag && <input type="hidden" name="tag" value={tag} />}
          <button type="submit" className="shrink-0 rounded-full border border-line bg-paper px-4 text-sm hover:bg-cream">
            検索
          </button>
        </div>
        {(popularTags.length > 0 || tag) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-soft">タグ：</span>
            {[...new Set([tag, ...popularTags].filter(Boolean))].map((t) => {
              const active = t === tag;
              const href = active ? `/lobby${q ? `?q=${encodeURIComponent(q)}` : ""}` : lobbyHref(q, t);
              return (
                <Link
                  key={t}
                  href={href}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1 ${active ? "bg-accent text-white" : "bg-paper hover:bg-cream"}`}
                >
                  #{t}
                  {active && " ×"}
                </Link>
              );
            })}
          </div>
        )}
      </form>

      {!filtering && activity.length > 0 && (
        <section aria-labelledby="following-now">
          <h2 id="following-now" className="mb-3 font-bold">
            いま勉強中のフォロー中の人
            <Link href="/follows" className="ml-2 text-sm font-normal text-ink-soft hover:underline">
              くらべる →
            </Link>
          </h2>
          <FollowingActivity items={activity} />
        </section>
      )}

      {!filtering && myRooms.length > 0 && (
        <section aria-labelledby="my-rooms">
          <h2 id="my-rooms" className="mb-3 font-bold">
            参加したことのある部屋
          </h2>
          <RoomGrid rooms={myRooms} />
        </section>
      )}

      <section aria-labelledby="public-rooms">
        <h2 id="public-rooms" className="mb-3 font-bold">
          {filtering ? "検索結果" : "公開中の部屋"}
          <span className="ml-2 text-sm font-normal text-ink-soft">在室人数の多い順</span>
        </h2>
        {publicRes.error ? (
          <p className="text-sm text-red-600">部屋を読み込めませんでした。</p>
        ) : publicRooms.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
            {filtering ? "条件に合う部屋はありません。" : "まだ部屋がありません。最初の部屋をつくってみませんか？"}
          </p>
        ) : (
          <RoomGrid rooms={publicRooms} />
        )}
      </section>
    </div>
  );
}

function lobbyHref(q: string, tag: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("tag", tag);
  return `/lobby?${params}`;
}

function RoomGrid({ rooms }: { rooms: RoomCardData[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((r) => (
        <li key={r.id}>
          <RoomCard room={r} />
        </li>
      ))}
    </ul>
  );
}
