import type { Metadata } from "next";
import { LegalLinks } from "@/components/legal-page";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "パスワードを忘れたとき" };

/** ログインしなくても開ける。ユーザーID＋復活コードで新しいパスワードにする */
export default function ResetPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">パスワードを忘れたとき</h1>
          <p className="mt-2 text-sm text-ink-soft">ユーザーIDと、保存しておいた復活コードを入れてください。</p>
        </div>
        <ResetForm />
        <LegalLinks className="mt-8" />
      </div>
    </main>
  );
}
