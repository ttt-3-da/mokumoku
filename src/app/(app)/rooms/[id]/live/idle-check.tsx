"use client";

import { useEffect, useRef, useState } from "react";
import { Mochi } from "@/components/mochi";
import type { Avatar } from "@/lib/avatar";
import { formatRemaining, IDLE_ASK_MS, idleRemainingMs } from "@/lib/idle";
import { playSound } from "@/lib/sound";
import { beatNow } from "./use-room-sync";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/**
 * 部屋の画面での最後の操作を覚えておき、30分操作がなければ「まだ勉強中？」と聞く。
 * 返事がないまま35分たつと、サーバー（cron）が最後に操作した時刻で退室にする。
 */
export function useIdleCheck() {
  const lastActive = useRef(0);
  // 聞いていないときは null。聞いている間は退室までの残り（ミリ秒）
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    lastActive.current = Date.now();
    let wasAsking = false;
    const onActivity = () => {
      lastActive.current = Date.now();
      if (wasAsking) {
        wasAsking = false;
        setRemainingMs(null);
        beatNow();
      }
    };
    const tick = () => {
      const t = Date.now();
      const asking = t - lastActive.current >= IDLE_ASK_MS;
      // 聞いている間だけ毎秒描き直す（残り時間の表示のため）
      if (asking) setRemainingMs(idleRemainingMs(lastActive.current, t));
      else if (wasAsking) setRemainingMs(null);
      wasAsking = asking;
    };
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { passive: true });
    const id = setInterval(tick, 1000);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity);
      clearInterval(id);
    };
  }, []);

  return {
    asking: remainingMs !== null,
    remainingMs: remainingMs ?? 0,
    getIdleSeconds: () => (lastActive.current ? Math.floor((Date.now() - lastActive.current) / 1000) : 0),
  };
}

export function IdleDialog({ remainingMs, avatar, seed, muted }: { remainingMs: number; avatar: Avatar; seed: string; muted: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 聞き始めたとき：音を鳴らし、ほかのタブを見ていても気づけるようにタブの名前を変える
  useEffect(() => {
    buttonRef.current?.focus();
    const stop = muted ? undefined : playSound("idleAsk");
    const title = document.title;
    let flip = false;
    const id = setInterval(() => {
      flip = !flip;
      document.title = flip ? "⏰ まだ勉強中？" : title;
    }, 1000);
    return () => {
      stop?.();
      clearInterval(id);
      document.title = title;
    };
  }, [muted]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-body"
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-paper p-6 text-center shadow-xl"
      >
        <Mochi avatar={avatar} seed={seed} size={80} state="away" />
        <h2 id="idle-title" className="text-lg font-bold">
          まだ勉強中？
        </h2>
        <p id="idle-body" className="text-sm leading-relaxed text-ink-soft">
          30分、画面の操作がありませんでした。
          <br />
          このままだと
          <b className="mx-1 tabular-nums text-ink">{formatRemaining(remainingMs)}</b>
          後に自動で退室になり、記録は最後に操作した時刻までになります。
        </p>
        {/* 押す（またはどこかを操作する）と、操作したことになって閉じる */}
        <button
          ref={buttonRef}
          type="button"
          className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-strong"
        >
          続ける
        </button>
      </div>
    </div>
  );
}
