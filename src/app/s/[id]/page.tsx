import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalLinks } from "@/components/legal-page";
import { Mochi } from "@/components/mochi";
import { ButtonLink } from "@/components/ui";
import { formatMinutes } from "@/lib/pomodoro";
import { shareDate } from "@/lib/share";
import { getSharedSession } from "./data";

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const s = await getSharedSession((await params).id);
  if (!s) return { title: "記録が見つかりません", robots: { index: false } };
  const title = `${s.displayName} さんは ${formatMinutes(s.minutes)} 勉強しました`;
  return {
    title,
    description: "声もカメラもいらない、もちといっしょのオンライン自習室「Mokumoku」での勉強の記録です。",
    // 1回ずつの記録は検索に出さない（シェアした先で見てもらうためのページ）
    robots: { index: false },
    openGraph: { title, type: "article", siteName: "Mokumoku" },
    twitter: { card: "summary_large_image", title },
  };
}

/** X などでシェアされた勉強の記録カード。ログインしていなくても見られる */
export default async function SharedSessionPage({ params }: PageProps<"/s/[id]">) {
  const s = await getSharedSession((await params).id);
  if (!s) notFound();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-line bg-paper px-6 py-8 shadow-sm">
          <Mochi avatar={s.avatar} size={120} seed="share" celebrate />
          <p className="text-sm text-ink-soft">{shareDate(s.endedAt)}</p>
          <p className="text-lg font-bold">{s.displayName} さんは</p>
          <p>
            <b className="text-4xl text-accent-strong">{formatMinutes(s.minutes)}</b>
            <span className="ml-1 font-bold">勉強しました</span>
          </p>
          {(s.pomodoros > 0 || s.todosDone > 0) && (
            <p className="flex gap-4 text-sm text-ink-soft">
              {s.pomodoros > 0 && <span>🍅 ポモドーロ {s.pomodoros}回</span>}
              {s.todosDone > 0 && <span>✅ ToDo {s.todosDone}個おわらせた</span>}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">Mokumoku</h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            声もカメラもいらない、だまって集中するオンライン自習室。
            <br />
            自分の分身の「もち」といっしょに、みんなでもくもく勉強しよう。
          </p>
        </div>
        <ButtonLink href="/login" className="w-full">
          Mokumoku をはじめる
        </ButtonLink>
        <LegalLinks className="mt-4" />
      </div>
    </main>
  );
}
