"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

/**
 * 自分のプロフィールの項目に付ける「みんなに見せる／自分だけ」の切りかえ（ワンタップ）。
 * 自分だけにした項目は、本人には薄く見え、ほかの人には出ない。
 */
export function SectionVisibility({
  section,
  label,
  initialHidden,
  children,
}: {
  section: string;
  label: string;
  initialHidden: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(initialHidden);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !hidden;
    setHidden(next);
    setError(null);
    start(async () => {
      const { error } = await createClient().rpc("set_profile_section_hidden", { p_section: section, p_hidden: next });
      if (error) {
        setHidden(!next);
        setError(rpcErrorMessage(error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end gap-2">
        {error && (
          <span role="alert" className="text-xs text-red-600">
            {error}
          </span>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={!hidden}
          aria-label={`${label}をみんなに見せる`}
          disabled={pending}
          onClick={toggle}
          className={`rounded-full px-3 py-1 text-xs font-bold shadow-sm transition ${
            hidden ? "bg-ink/10 text-ink-soft hover:bg-ink/15" : "bg-paper text-ink hover:bg-sakura/20"
          }`}
        >
          {hidden ? "🙈 自分だけ" : "👀 みんなに公開"}
        </button>
      </div>
      <div className={hidden ? "opacity-50" : undefined}>{children}</div>
    </section>
  );
}
