import type { Metadata } from "next";
import { Mochi } from "@/components/mochi";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, deleted } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Mochi size={96} seed="login" avatar={{ color: "shiro", eyes: "smile", mouth: "omega", cheeks: "pink", head: "leaf", desk: "none", hachimaki: "red" }} className="animate-mochi-drop" />
          <h1 className="text-3xl font-bold tracking-wide">Mokumoku</h1>
          <p className="text-sm text-ink-soft">おしゃべりなしの、もくもく自習室。</p>
        </div>
        {deleted === "1" && (
          <p role="status" className="mb-4 rounded-2xl bg-paper px-4 py-3 text-center text-sm shadow-sm">
            退会しました。これまで使ってくれてありがとうございました。
          </p>
        )}
        <AuthForm next={typeof next === "string" ? next : ""} />
      </div>
    </main>
  );
}
