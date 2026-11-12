"use client";

import type { CSSProperties, ReactNode } from "react";
import { ROOM_THEMES, SKY, TIME_OF_DAY_LABEL, timeOfDay, type RoomTheme } from "@/lib/room-theme";

/**
 * 部屋の背景（フェーズ13）。
 * - 上に窓。窓の外は日本時間の時間帯（朝・昼・夕方・夜）で変わる
 * - テーマ（図書館・カフェ・和室・宇宙）で壁・床・机の色と小物が変わる
 * - ポモドーロの休憩中は部屋全体が少し明るくなる
 */
export function RoomScene({
  theme,
  now,
  onBreak,
  className = "",
  children,
}: {
  theme: RoomTheme;
  now: number | null;
  onBreak: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = ROOM_THEMES[theme];
  const tod = now === null ? "day" : timeOfDay(now);
  const [skyTop, skyBottom] = SKY[tod];
  const dark = theme === "space";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-line transition-[filter] duration-1000 ${onBreak ? "brightness-110" : ""} ${className}`}
      style={
        {
          background: `linear-gradient(${t.wall} 0 62%, ${t.floor} 62% 100%)`,
          "--desk": t.desk,
          "--desk-edge": t.deskEdge,
        } as CSSProperties
      }
      data-theme={theme}
      data-time-of-day={tod}
    >
      {/* 壁の飾りと窓 */}
      <div className="flex items-end justify-center gap-4 px-4 pt-4" aria-hidden>
        <Decor theme={theme} side="left" />
        <div
          className="relative h-20 w-40 overflow-hidden rounded-xl border-4 sm:w-56"
          style={{
            background: dark ? "radial-gradient(circle at 30% 40%, #3b4675, #0d1022)" : `linear-gradient(${skyTop}, ${skyBottom})`,
            borderColor: theme === "washitsu" ? "#b08b5c" : dark ? "#8d96c4" : "#fffaf3",
          }}
        >
          <Sky tod={dark ? "night" : tod} space={dark} />
          {theme === "washitsu" && (
            // 障子の桟
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-2">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="border border-[#b08b5c]/50" />
              ))}
            </div>
          )}
        </div>
        <Decor theme={theme} side="right" />
      </div>
      <p className={`mt-1 text-center text-[11px] ${dark ? "text-indigo-100" : "text-ink-soft"}`}>
        {t.icon} {t.label}・{TIME_OF_DAY_LABEL[tod]}
        {onBreak && "・休憩中"}
      </p>
      <div className="relative p-4">{children}</div>
    </div>
  );
}

function Sky({ tod, space }: { tod: keyof typeof SKY; space: boolean }) {
  if (space) {
    return (
      <>
        {[
          [12, 20],
          [40, 60],
          [70, 25],
          [85, 70],
          [25, 75],
          [58, 40],
        ].map(([x, y], i) => (
          <span key={i} className="absolute h-1 w-1 rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, opacity: 0.8 }} />
        ))}
        <span className="absolute right-4 top-3 h-8 w-8 rounded-full bg-[#f4a6b8] shadow-[inset_-6px_-4px_0_#d76c86]" />
        <span className="absolute right-1 top-6 h-1.5 w-14 -rotate-12 rounded-full bg-[#ffd34d]/70" />
      </>
    );
  }
  if (tod === "night") {
    return (
      <>
        <span className="absolute right-5 top-3 h-7 w-7 rounded-full bg-[#fff6c8] shadow-[inset_-5px_-2px_0_#e9dc9a]" />
        {[
          [15, 25],
          [35, 60],
          [55, 20],
          [20, 70],
        ].map(([x, y], i) => (
          <span key={i} className="absolute h-1 w-1 rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </>
    );
  }
  const sun = { morning: "left-4 top-8 bg-[#ffd98a]", day: "right-6 top-2 bg-[#ffe680]", evening: "left-1/2 top-10 bg-[#ff9c6b]" }[tod];
  return (
    <>
      <span className={`absolute h-8 w-8 rounded-full ${sun}`} />
      <span className="absolute bottom-3 left-6 h-3 w-12 rounded-full bg-white/80" />
      <span className="absolute bottom-5 left-10 h-3 w-8 rounded-full bg-white/80" />
    </>
  );
}

function Decor({ theme, side }: { theme: RoomTheme; side: "left" | "right" }) {
  switch (theme) {
    case "library":
      // 本棚
      return (
        <div className="hidden h-16 w-16 flex-col justify-around rounded-md bg-[#b08b5c] p-1 sm:flex">
          {[0, 1].map((row) => (
            <div key={row} className="flex h-5 items-end gap-0.5 rounded-sm bg-[#8d6446] px-0.5">
              {["#e98aa1", "#8fb98b", "#8ec6de", "#e6c88f", "#cdb7e6"].map((c, i) => (
                <span key={i} className="w-1.5 rounded-t-sm" style={{ background: c, height: `${60 + ((i * 7 + row * 13 + (side === "left" ? 0 : 5)) % 40)}%` }} />
              ))}
            </div>
          ))}
        </div>
      );
    case "cafe":
      // つり下げランプ
      return (
        <div className="hidden h-16 flex-col items-center sm:flex">
          <span className="h-8 w-0.5 bg-[#8d6446]" />
          <span className="h-4 w-8 rounded-t-full bg-[#e6c88f]" />
          <span className="h-2 w-6 rounded-full bg-[#fff2b3]/80" />
        </div>
      );
    case "washitsu":
      // 掛け軸
      return (
        <div className="hidden h-16 w-8 flex-col items-center rounded-sm bg-[#f8f3e6] py-1 shadow sm:flex">
          <span className="h-1 w-full bg-[#8d6446]" />
          <span className="mt-2 text-[10px] leading-none text-[#3f3a36] [writing-mode:vertical-rl]">{side === "left" ? "集中" : "一歩"}</span>
        </div>
      );
    case "space":
      // 丸窓の計器
      return (
        <div className="hidden h-12 w-12 items-center justify-center rounded-full border-4 border-[#8d96c4] bg-[#1a1f3d] sm:flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#8fb98b]" />
        </div>
      );
  }
}
