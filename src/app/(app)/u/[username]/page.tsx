import type { Metadata } from "next";
import Link from "next/link";
import { AdminActions } from "@/components/admin-actions";
import { AdminEditProfile } from "@/components/admin-edit-profile";
import { OfficialBadge } from "@/components/official-badge";
import { DeskItem, Mochi } from "@/components/mochi";
import { BadgeGrid } from "@/components/badge-grid";
import { FollowButton } from "@/components/follow-button";
import { ReportButton } from "@/components/report-button";
import { ButtonLink, Card } from "@/components/ui";
import { WeeklyGoalBar } from "@/components/weekly-goal";
import { UNLOCK_ITEM_LABEL, UNLOCKABLE_ITEMS } from "@/lib/avatar";
import { BADGE_IDS, isBadgeId, type BadgeId } from "@/lib/badges";
import type { FollowInfo } from "@/lib/follow";
import { parseWeeklyProgress } from "@/lib/goals";
import { plantLevel } from "@/lib/room-theme";
import type { ProfileStats } from "@/lib/stats";
import { createClient, getAvatar, getUnlocks, requireProfile } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ProfileStatsView } from "./profile-stats";

const BADGE_COUNT = BADGE_IDS.length;

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const me = await requireProfile();
  const supabase = await createClient();

  // 非公開のプロフィールは RLS で本人以外には返らない
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, created_at, bio, is_public, stats_public, is_admin, suspended_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!data) return <NotAvailable />;
  const profile = data as Profile;
  const isMe = profile.id === me.id;
  const [avatar, unlocks, { data: statsData }, { data: followData }, { data: progressData }, { data: badgeData }, { data: access }] = await Promise.all([
    getAvatar(profile.id),
    getUnlocks(profile.id),
    supabase.rpc("get_profile_stats", { p_username: profile.username }),
    supabase.rpc("get_follow_info", { p_username: profile.username }),
    supabase.rpc("get_weekly_progress", { p_username: profile.username }),
    supabase.rpc("list_user_badges", { p_username: profile.username }),
    me.is_admin && !isMe ? supabase.rpc("admin_get_access", { p_user_id: profile.id }) : Promise.resolve({ data: null }),
  ]);
  const progress = parseWeeklyProgress(progressData);
  const badges = new Map<BadgeId, string>();
  for (const b of (badgeData ?? []) as { badge_id: string; earned_at: string }[]) {
    if (isBadgeId(b.badge_id)) badges.set(b.badge_id, b.earned_at);
  }
  const follow = followData as FollowInfo | null;
  const stats = statsData as ProfileStats | null;

  const joined = new Date(profile.created_at).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <div className="flex items-end">
            <Mochi avatar={avatar} size={96} seed={profile.id} label={`${profile.display_name}のもち`} />
            <DeskItem kind={avatar.desk} size={34} level={plantLevel(stats?.total_minutes ?? 0)} />
          </div>
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold">
              <span className="truncate">{profile.display_name}</span>
              {profile.is_admin && <OfficialBadge />}
            </h1>
            <p className="text-sm text-ink-soft">@{profile.username}</p>
            <p className="mt-1 text-xs text-ink-soft">{joined} から参加</p>
            {isMe && !profile.is_public && (
              <p className="mt-1 inline-block rounded-full bg-cream px-2 py-0.5 text-xs">🔒 非公開中（ほかの人には見えません）</p>
            )}
            {follow && (
              <p className="mt-2 flex gap-3 text-sm">
                <Link href={`/u/${profile.username}/following`} className="hover:underline">
                  <b className="tabular-nums">{follow.following}</b> <span className="text-ink-soft">フォロー中</span>
                </Link>
                <Link href={`/u/${profile.username}/followers`} className="hover:underline">
                  <b className="tabular-nums">{follow.followers}</b> <span className="text-ink-soft">フォロワー</span>
                </Link>
                {!isMe && follow.follows_me && <span className="rounded-full bg-cream px-2 text-xs leading-5">フォローされています</span>}
              </p>
            )}
            {!isMe && me.is_admin && <AccessInfo access={access as Access | null} />}
            {!isMe && me.is_admin && <AdminEditProfile key={`${profile.display_name}-${profile.bio}`} userId={profile.id} displayName={profile.display_name} bio={profile.bio ?? ""} />}
            {!isMe && me.is_admin && (
              <AdminActions
                className="mt-3"
                actions={[
                  { label: "名前と自己紹介を消す", confirm: "このユーザーの表示名と自己紹介を消しますか？", rpc: "admin_clear_user_text", args: { p_user_id: profile.id } },
                  profile.suspended_at
                    ? { label: "利用停止を解除", confirm: "利用停止を解除しますか？", rpc: "admin_set_suspended", args: { p_user_id: profile.id, p_suspended: false } }
                    : { label: "利用停止", confirm: "このユーザーを利用停止にしますか？（あとで解除できます）", rpc: "admin_set_suspended", args: { p_user_id: profile.id, p_suspended: true }, danger: true },
                ]}
              />
            )}
            {!isMe && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {follow && <FollowButton username={profile.username} initialFollowing={follow.is_following} followsMe={follow.follows_me} />}
                <ReportButton targetType="user" targetId={profile.id} />
              </div>
            )}
            {isMe && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/avatar" variant="secondary">
                  もちを着せかえる
                </ButtonLink>
                <ButtonLink href="/settings" variant="ghost">
                  プロフィールを編集
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
        {profile.bio ? (
          <p className="whitespace-pre-wrap break-words rounded-2xl bg-cream px-4 py-3 text-sm">{profile.bio}</p>
        ) : (
          isMe && (
            <p className="text-sm text-ink-soft">
              自己紹介はまだありません。<Link href="/settings" className="underline">設定</Link>から書けます。
            </p>
          )
        )}
      </Card>

      {progress && <WeeklyGoalBar progress={progress} isMe={isMe} />}

      {stats ? (
        <ProfileStatsView stats={stats} />
      ) : (
        <Card className="text-center text-sm text-ink-soft">学習の統計は非公開です。</Card>
      )}

      <Card>
        <h2 className="mb-3 font-bold">
          実績バッジ
          <span className="ml-2 text-sm font-normal text-ink-soft tabular-nums">
            {badges.size} / {BADGE_COUNT}
          </span>
        </h2>
        <BadgeGrid earned={badges} />
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">集めたアイテム</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {Object.entries(UNLOCKABLE_ITEMS).map(([id, condition]) => {
            const got = unlocks.includes(id);
            return (
              <li key={id} className={`rounded-2xl px-3 py-2 ${got ? "bg-sakura/15" : "bg-cream text-ink-soft"}`}>
                <span aria-hidden>{got ? "🎁" : "🔒"}</span> {UNLOCK_ITEM_LABEL[id as keyof typeof UNLOCK_ITEM_LABEL]}
                <span className="block text-[11px] text-ink-soft">{condition}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function NotAvailable() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <Mochi size={80} seed="private" state="away" />
      <h1 className="text-lg font-bold">このプロフィールは見られません</h1>
      <p className="text-sm text-ink-soft">ユーザーが見つからないか、プロフィールを非公開にしています。</p>
      <ButtonLink href="/users" variant="secondary">
        ユーザーをさがす
      </ButtonLink>
    </div>
  );
}

type Access = { first_country: string | null; first_seen_at: string; last_country: string | null; last_seen_at: string };

function countryName(code: string | null) {
  if (!code) return "不明";
  try {
    return `${new Intl.DisplayNames(["ja"], { type: "region" }).of(code) ?? code}（${code}）`;
  } catch {
    return code;
  }
}

/** 管理者だけに見せる、アクセスした国（IP は記録していない） */
function AccessInfo({ access }: { access: Access | null }) {
  const at = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });
  return (
    <p className="mt-3 text-xs text-ink-soft">
      {access
        ? `アクセスした国：はじめ ${countryName(access.first_country)}・${at(access.first_seen_at)} ／ 最近 ${countryName(access.last_country)}・${at(access.last_seen_at)}`
        : "アクセスした国：まだ記録がありません"}
    </p>
  );
}
