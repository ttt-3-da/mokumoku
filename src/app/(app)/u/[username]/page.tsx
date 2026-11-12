import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeskItem, Mochi } from "@/components/mochi";
import { ReportButton } from "@/components/report-button";
import { ButtonLink, Card } from "@/components/ui";
import { UNLOCK_ITEM_LABEL, UNLOCKABLE_ITEMS } from "@/lib/avatar";
import { createClient, getAvatar, getUnlocks, requireProfile } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { plantLevel } from "@/lib/room-theme";
import type { ProfileStats } from "@/lib/stats";
import { DisplayNameForm } from "./display-name-form";
import { ProfileStatsView } from "./profile-stats";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const me = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!data) notFound();
  const profile = data as Profile;
  const isMe = profile.id === me.id;
  const [avatar, unlocks, { data: statsData }] = await Promise.all([
    getAvatar(profile.id),
    getUnlocks(profile.id),
    supabase.rpc("get_profile_stats", { p_username: profile.username }),
  ]);
  const stats = statsData as ProfileStats | null;

  const joined = new Date(profile.created_at).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex items-center gap-5">
        <div className="flex items-end">
          <Mochi avatar={avatar} size={96} seed={profile.id} label={`${profile.display_name}のもち`} />
          <DeskItem kind={avatar.desk} size={34} level={plantLevel(stats?.total_minutes ?? 0)} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-ink-soft">@{profile.username}</p>
          <p className="mt-1 text-xs text-ink-soft">{joined} から参加</p>
          {!isMe && <ReportButton targetType="user" targetId={profile.id} className="mt-2" />}
          {isMe && (
            <ButtonLink href="/avatar" variant="secondary" className="mt-3">
              もちを着せかえる
            </ButtonLink>
          )}
        </div>
      </Card>


      {stats && <ProfileStatsView stats={stats} />}

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

      {isMe && (
        <Card>
          <h2 className="mb-3 font-bold">表示名を変更</h2>
          <DisplayNameForm current={profile.display_name} />
        </Card>
      )}

    </div>
  );
}

