import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { feedbackKindLabel } from "@/lib/feedback";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "ご意見・不具合" };

type MyFeedback = { id: string; kind: string; body: string; created_at: string; reply: string | null; replied_at: string | null };

const dateText = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function FeedbackPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_feedback");
  const mine = (data ?? []) as MyFeedback[];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">ご意見・不具合</h1>
        <p className="mt-1 text-sm text-ink-soft">Mokumoku の運営に届きます。すべて読んでいます。運営から返信が届くと、🔔 お知らせでわかります。</p>
      </div>
      <Card>
        <FeedbackForm />
      </Card>
      {mine.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="あなたが送ったもの">
          <h2 className="font-bold">あなたが送ったもの</h2>
          <ul className="flex flex-col gap-3">
            {mine.map((f) => (
              <li key={f.id}>
                <Card className="flex flex-col gap-2 text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded-full bg-cream px-2 text-xs">{feedbackKindLabel(f.kind)}</span>
                    <span className="ml-auto text-xs text-ink-soft">{dateText(f.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{f.body}</p>
                  {f.reply ? (
                    <div className="rounded-xl bg-sakura/15 px-3 py-2">
                      <span className="text-xs font-bold text-ink-soft">💌 運営からの返信（{dateText(f.replied_at!)}）</span>
                      <p className="whitespace-pre-wrap break-words">{f.reply}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-soft">まだ返信はありません</span>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
