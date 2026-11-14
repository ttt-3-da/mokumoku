import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "ご意見・不具合" };

export default function FeedbackPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">ご意見・不具合</h1>
        <p className="mt-1 text-sm text-ink-soft">Mokumoku の運営に届きます。返事はできませんが、すべて読んでいます。</p>
      </div>
      <Card>
        <FeedbackForm />
      </Card>
    </div>
  );
}
