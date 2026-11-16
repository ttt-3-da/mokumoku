import Link from "next/link";

/** 利用規約・プライバシーポリシーの共通の見た目（ログインしていなくても読める） */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-ink-soft hover:underline">
        ← Mokumoku
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-xs text-ink-soft">最終更新日：{updated}</p>
      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed">{children}</div>
      <LegalLinks className="mt-10" />
    </main>
  );
}

/** 利用規約とプライバシーポリシーへのリンク */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`flex justify-center gap-4 text-xs text-ink-soft ${className}`}>
      <Link href="/terms" className="hover:underline">
        利用規約
      </Link>
      <Link href="/privacy" className="hover:underline">
        プライバシーポリシー
      </Link>
    </p>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}
