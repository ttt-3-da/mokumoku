"use client";

import { setSoundEnabled, useSoundEnabled } from "@/lib/mochi-sound";

/** 効果音を鳴らすかどうかの切りかえ（最初は鳴らさない） */
export function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? "効果音を消す" : "効果音を鳴らす"}
      title={on ? "効果音を消す" : "効果音を鳴らす"}
      className={`rounded-full bg-paper px-3 py-1.5 text-sm shadow-sm hover:bg-sakura/20 ${className}`}
    >
      {on ? "🔊 音あり" : "🔇 音なし"}
    </button>
  );
}
