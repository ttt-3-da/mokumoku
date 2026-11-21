import type { Metadata } from "next";
import Link from "next/link";
import { BlockButton } from "@/components/block-button";
import { InstallApp } from "@/components/install-app";
import { Mochi } from "@/components/mochi";
import { RecoveryCodeMaker } from "@/components/recovery-code";
import { Card } from "@/components/ui";
import { parseAvatar } from "@/lib/avatar";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { ColorSchemeForm, DeleteAccountForm, GoalForm, OfflineLeaveForm, PasswordForm, ProfileForm, VisibilityForm } from "./forms";

export const metadata: Metadata = { title: "設定" };

const dateFormat = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });

export default async function SettingsPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const [{ data: blockData }, { data: recoveryCreatedAt }] = await Promise.all([
    supabase.rpc("list_blocks"),
    supabase.rpc("recovery_code_created_at"),
  ]);
  const blocks = (blockData ?? []) as { username: string; display_name: string; avatar: unknown }[];

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
        <h2 className="mb-1 font-bold">ホーム画面に追加</h2>
        <p className="mb-3 text-xs text-ink-soft">スマホのホーム画面にアプリのように置いて、すぐ開けます。</p>
        <InstallApp />
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">週の目標</h2>
        <p className="mb-3 text-xs text-ink-soft">ロビーとプロフィールに今週の進み具合が出ます（プロフィールでは統計を見せる設定のときだけ）。</p>
        <GoalForm goalMinutes={me.weekly_goal_minutes} />
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">🔌 電源が切れたときの退室</h2>
        <p className="mb-3 text-xs text-ink-soft">
          スマホやパソコンの電源が切れたり、通信が切れたりして部屋の画面とつながらなくなってから、何分で退室にするかを選べます。
          タブを閉じたとき・ほかのタブを見ているときは、この設定とは別です。
        </p>
        <OfflineLeaveForm minutes={me.offline_leave_minutes} />
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
        <h2 className="mb-1 font-bold">ブロックしている人</h2>
        <p className="mb-3 text-xs text-ink-soft">ブロックは、その人のプロフィールの「🚫 ブロック」からできます。</p>
        {blocks.length === 0 ? (
          <p className="text-sm text-ink-soft">いません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => (
              <li key={b.username} className="flex items-center gap-3">
                <Mochi avatar={parseAvatar(b.avatar)} size={36} seed={b.username} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {b.display_name} <span className="text-ink-soft">@{b.username}</span>
                </span>
                <BlockButton username={b.username} displayName={b.display_name} initialBlocking />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">パスワード変更</h2>
        <PasswordForm username={me.username} />
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">🔑 復活コード</h2>
        <p className="mb-3 text-xs text-ink-soft">
          パスワードを忘れたとき、ログイン画面の「パスワードを忘れた？」から、ユーザーIDと復活コードで新しいパスワードを決められます。
          {recoveryCreatedAt
            ? `（${dateFormat.format(new Date(recoveryCreatedAt))} に作ったコードが使えます。なくしたときは作り直してください）`
            : "まだ作っていません。作っておきましょう。"}
        </p>
        <RecoveryCodeMaker username={me.username} hasCode={Boolean(recoveryCreatedAt)} />
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
