import type { Metadata } from "next";
import { RecoveryCodeMaker } from "@/components/recovery-code";
import { ButtonLink, Card } from "@/components/ui";
import { createClient, requireProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "復活コード" };

/** 登録した直後に来る画面。パスワードを忘れたときのための復活コードを作ってもらう */
export default async function RecoveryCodePage({ searchParams }: PageProps<"/recovery-code">) {
  const welcome = (await searchParams).welcome === "1";
  const me = await requireProfile();
  const { data: createdAt } = await (await createClient()).rpc("recovery_code_created_at");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{welcome ? "ようこそ！ さいしょに復活コードを作ろう" : "🔑 復活コード"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Mokumoku はメールアドレスを使いません。そのかわり、パスワードを忘れたときは
          <b className="text-ink">ユーザーIDと復活コード</b>で新しいパスワードを決められます。
        </p>
      </div>
      <Card>
        <RecoveryCodeMaker username={me.username} hasCode={Boolean(createdAt)} />
      </Card>
      <ButtonLink href={welcome ? "/lobby?tour=1" : "/settings"} variant="secondary">
        {welcome ? "保存したので、はじめる →" : "設定にもどる"}
      </ButtonLink>
      {welcome && <p className="text-center text-xs text-ink-soft">あとで設定の画面から作ることもできます。</p>}
    </div>
  );
}
