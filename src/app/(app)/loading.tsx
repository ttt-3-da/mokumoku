import { Mochi } from "@/components/mochi";

/** 画面を切り替えている間、すぐに表示する読み込み中の画面 */
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24" role="status" aria-live="polite">
      <Mochi size={72} seed="loading" state="idle" />
      <p className="text-sm text-ink-soft">よみこみ中…</p>
    </div>
  );
}
