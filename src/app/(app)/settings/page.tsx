import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { requireProfile } from "@/lib/supabase/server";
import { ColorSchemeForm, DeleteAccountForm, GoalForm, PasswordForm, ProfileForm, VisibilityForm } from "./forms";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const me = await requireProfile();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="mt-1 text-xs text-ink-soft">
          もちの見た目は{" "}
          <Link href="/avatar" className="underline">
            着せかえ
          </Link>{" "}
          から変えられます。
          <Link href="/lobby?tour=1" className="ml-2 underline">
            使い方をもう一度見る
          </Link>
          <Link href="/feedback" className="ml-2 underline">
            ご意見・不具合を送る
          </Link>
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-bold">プロフィール</h2>
        <ProfileForm displayName={me.display_name} bio={me.bio} />
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">週の目標</h2>
        <p className="mb-3 text-xs text-ink-soft">ロビーとプロフィールに今週の進み具合が出ます（プロフィールでは統計を見せる設定のときだけ）。</p>
        <GoalForm goalMinutes={me.weekly_goal_minutes} />
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">見た目のモード</h2>
        <p className="mb-3 text-xs text-ink-soft">このブラウザに保存されます。</p>
        <ColorSchemeForm />
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">公開範囲</h2>
        <p className="mb-3 text-xs text-ink-soft">部屋の中でのもち・名前・今やることは、設定にかかわらず同じ部屋の人に見えます。</p>
        <VisibilityForm isPublic={me.is_public} statsPublic={me.stats_public} />
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">パスワード変更</h2>
        <PasswordForm username={me.username} />
      </Card>

      <Card className="border-red-200">
        <h2 className="mb-1 font-bold text-red-700">退会</h2>
        <p className="mb-3 text-xs text-ink-soft">
          アカウント・学習の記録・もち・集めたアイテムがすべて消え、元に戻せません。
          あなたがオーナーの部屋は閉じて残り、その部屋で勉強したほかの人の記録は消えません。
        </p>
        <DeleteAccountForm username={me.username} />
      </Card>
    </div>
  );
}
