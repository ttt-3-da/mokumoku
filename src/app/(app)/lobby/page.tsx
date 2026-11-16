import type { Metadata } from "next";
import Link from "next/link";
import { FollowingActivity } from "@/components/following-activity";
import { LastWeekCard, UpcomingSchedules, type UpcomingSchedule } from "@/components/lobby-extras";
import { WeeklyGoalBar } from "@/components/weekly-goal";
import { isMondayInJapan, parseLastWeekSummary, parseWeeklyProgress } from "@/lib/goals";
import { RoomCard } from "@/components/room-card";
import { parseAvatar, type Avatar } from "@/lib/avatar";
import type { FollowingActivity as FollowingActivityRow } from "@/lib/follow";
import { ButtonLink, inputClass } from "@/components/ui";
import { createClient, getAvatar, requireProfile } from "@/lib/supabase/server";
import { Tour } from "./tour";
import type { RoomCard as RoomCardData, RoomOwner } from "@/lib/types";

export const metadata: Metadata = { title: "ロビー" };

function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function LobbyPage({ searchParams }: PageProps<"/lobby">) {
  const sp = await searchParams;
  const q = param(sp.q).slice(0, 40);
  const tag = param(sp.tag).slice(0, 15);

  const supabase = await createClient();
  const me = await requireProfile();
  const avatar = await getAvatar(me.id);
  const now = new Date();
  const monday = isMondayInJapan(now);
  const [publicRes, mineRes, activityRes, progressRes, upcomingRes, summaryRes, recoveryRes] = await Promise.all([
    supabase.rpc("list_public_rooms", { p_query: q || null, p_tag: tag || null }),
    supabase.rpc("list_my_rooms"),
    supabase.rpc("list_following_activity"),
    supabase.rpc("get_weekly_progress"),
    supabase.rpc("list_upcoming_schedules"),
    monday ? supabase.rpc("last_week_summary") : Promise.resolve({ data: null }),
    supabase.rpc("recovery_code_created_at"),
  ]);
  const needsRecoveryCode = !recoveryRes.error && !recoveryRes.data;
  const progress = parseWeeklyProgress(progressRes.data);
  const upcoming = (upcomingRes.data ?? []) as UpcomingSchedule[];
  const summary = parseLastWeekSummary(summaryRes.data);
  const activity = ((activityRes.data ?? []) as FollowingActivityRow[]).map((a) => ({ ...a, avatar: parseAvatar(a.avatar) }));

  const publicRooms = (publicRes.data ?? []) as RoomCardData[];
  const myRooms = (mineRes.data ?? []) as RoomCardData[];
  const filtering = Boolean(q || tag);

  // いま勉強中の人数と、部屋に入っている人のもち
  const shown = new Map<string, RoomCardData>();
  for (const r of [...myRooms, ...publicRooms]) shown.set(r.id, r);
  const studyingNow = [...shown.values()].reduce((n, r) => n + r.active_count, 0);
  const busiest = publicRooms.filter((r) => r.active_count > 0 && r.active_count < r.capacity).sort((a, b) => b.active_count - a.active_count)[0];
  const busyIds = [...shown.values()].filter((r) => r.active_count > 0).map((r) => r.id);
  const shownIds = [...shown.keys()];
  const [facesRes, ownersRes] = await Promise.all([
    busyIds.length > 0 ? supabase.rpc("room_member_avatars", { p_room_ids: busyIds }) : Promise.resolve({ data: null }),
    shownIds.length > 0 ? supabase.rpc("room_owners", { p_room_ids: shownIds }) : Promise.resolve({ data: null }),
  ]);
  const owners = new Map<string, RoomOwner>(((ownersRes.data ?? []) as RoomOwner[]).map((o) => [o.room_id, o]));
  const faces = new Map<string, Avatar[]>(
    ((facesRes.data ?? []) as { room_id: string; avatars: unknown[] }[]).map((r) => [r.room_id, (r.avatars ?? []).map(parseAvatar)]),
  );

  // 表示中の公開部屋から、よく使われているタグを集めて絞り込み候補にする
  const tagCounts = new Map<string, number>();
  for (const r of publicRooms) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const popularTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);

  return (
    <div className="flex flex-col gap-8">
      <Tour open={param(sp.tour) === "1"} avatar={avatar} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">ロビー</h1>
        <ButtonLink href="/rooms/new" className="ml-auto" data-tour="create-room">
          ＋ 部屋をつくる
        </ButtonLink>
      </div>

      {needsRecoveryCode && (
        <Link href="/recovery-code" className="flex items-center gap-3 rounded-3xl border border-accent bg-paper px-5 py-3 text-sm hover:bg-cream">
          <span aria-hidden className="text-xl">🔑</span>
          <span>
            <b>パスワードを忘れたときのために、復活コードを作っておこう</b>
            <span className="block text-xs text-ink-soft">メールアドレスがなくても、ユーザーIDと復活コードで新しいパスワードにできます。</span>
          </span>
          <span aria-hidden className="ml-auto text-ink-soft">→</span>
        </Link>
      )}

      {!filtering && (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-sakura/20 px-5 py-4">
          <p className="text-sm">
            いま <b className="text-3xl tabular-nums">{studyingNow}</b> 人が勉強中
          </p>
          {busiest ? (
            <ButtonLink href={`/rooms/${busiest.id}`} className="ml-auto">
              すぐ入る（{busiest.icon} {busiest.name}）
            </ButtonLink>
          ) : (
            <span className="ml-auto text-xs text-ink-soft">一番乗りで部屋に入ってみよう</span>
          )}
        </div>
      )}

      {!filtering && progress && (
        <div data-tour="goal">
          <WeeklyGoalBar progress={progress} isMe />
        </div>
      )}
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
          <RoomGrid rooms={myRooms} faces={faces} owners={owners} />
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
          <p data-tour="rooms" className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
            {filtering ? "条件に合う部屋はありません。" : "まだ部屋がありません。最初の部屋をつくってみませんか？"}
          </p>
        ) : (
          <RoomGrid rooms={publicRooms} faces={faces} owners={owners} tourFirst />
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

/** tourFirst：最初の部屋を使い方の案内で指す */
function RoomGrid({ rooms, faces, owners, tourFirst = false }: { rooms: RoomCardData[]; faces: Map<string, Avatar[]>; owners: Map<string, RoomOwner>; tourFirst?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((r, i) => (
        <li key={r.id} data-tour={tourFirst && i === 0 ? "rooms" : undefined}>
          <RoomCard room={r} faces={faces.get(r.id)} owner={owners.get(r.id)} />
        </li>
      ))}
    </ul>
  );
}
