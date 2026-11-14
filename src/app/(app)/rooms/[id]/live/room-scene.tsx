"use client";

import type { CSSProperties, ReactNode } from "react";
import { ROOM_THEMES, SKY, TIME_OF_DAY_LABEL, timeOfDay, type RoomTheme, type SceneMotion, type TimeOfDay } from "@/lib/room-theme";

/**
 * 部屋の背景。
 * - window テーマ：壁と床、真ん中に窓（外は日本時間の朝・昼・夕方・夜で変わる）、左右に飾り
 * - scene テーマ：部屋全体が景色（森・海辺・水族館など）。時間帯で全体の色味が変わる
 * - テーマごとに小さな動き（花びら・雪・魚など）。動きは少なめ・ゆっくりで、
 *   見ていないタブ（.anim-paused）や「動きを減らす」設定では止まる
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
  const realTod: TimeOfDay = now === null ? "day" : timeOfDay(now);
  const tod: TimeOfDay = t.alwaysNight ? "night" : realTod;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-line transition-[filter] duration-1000 ${t.backdrop === "scene" ? "scene-bg" : ""} ${onBreak ? "brightness-110" : ""} ${className}`}
      style={
        {
          // 景色テーマは、景色の地面の高さで空と床を分ける（globals.css の .scene-bg）
          background: t.backdrop === "scene" ? undefined : `linear-gradient(${t.wall} 0 62%, ${t.floor} 62% 100%)`,
          "--wall": t.wall,
          "--floor": t.floor,
          "--desk": t.desk,
          "--desk-edge": t.deskEdge,
        } as CSSProperties
      }
      data-theme={theme}
      data-time-of-day={tod}
    >
      {t.backdrop === "scene" ? (
        <>
          <SceneBackdrop theme={theme} tod={tod} />
          {/* 景色の上半分ぶんの高さを空けておく */}
          <div className="h-24 sm:h-28" aria-hidden />
        </>
      ) : (
        <div className="relative flex items-end justify-center gap-2 px-4 pt-4 sm:gap-4" aria-hidden>
          <DecorSlot>
            <Decor theme={theme} side="left" />
          </DecorSlot>
          <Window theme={theme} tod={tod} />
          <DecorSlot>
            <Decor theme={theme} side="right" />
          </DecorSlot>
        </div>
      )}
      {t.backdrop === "scene" && <TimeTint tod={tod} alwaysNight={Boolean(t.alwaysNight)} />}
      <Motion kind={t.motion} />
      <p
        className={`relative mt-1 text-center text-[11px] ${
          t.dark || (t.backdrop === "scene" && tod === "night") ? "text-white/85" : "text-ink-soft"
        }`}
      >
        {t.icon} {t.label}
        {!t.alwaysNight && `・${TIME_OF_DAY_LABEL[realTod]}`}
        {onBreak && "・休憩中"}
      </p>
      <div className="relative p-4">{children}</div>
    </div>
  );
}

/** 景色テーマの時間帯の色味（夜は暗く、夕方はオレンジがかる） */
function TimeTint({ tod, alwaysNight }: { tod: TimeOfDay; alwaysNight: boolean }) {
  if (alwaysNight) return null; // もともと夜の絵
  const color = { morning: "rgba(255,200,150,0.12)", day: "transparent", evening: "rgba(255,140,80,0.2)", night: "rgba(20,30,70,0.45)" }[tod];
  return <div className="pointer-events-none absolute inset-0 transition-colors duration-1000" style={{ background: color }} aria-hidden />;
}

// ---------------------------------------------------------------- 窓

function Window({ theme, tod }: { theme: RoomTheme; tod: TimeOfDay }) {
  const [skyTop, skyBottom] = SKY[tod];
  const space = theme === "space";
  const frame =
    theme === "washitsu" ? "#b08b5c" : space ? "#8d96c4" : theme === "lodge" || theme === "castle" || theme === "night_library" ? "#5c3d28" : "#fffaf3";
  const arched = theme === "castle";
  const wide = theme === "train";
  return (
    <div
      className={`relative h-20 overflow-hidden border-4 ${wide ? "w-44 rounded-2xl sm:w-80" : "w-40 sm:w-56"} ${arched ? "rounded-t-[999px] rounded-b-md" : "rounded-xl"}`}
      style={{
        background: space ? "radial-gradient(circle at 30% 40%, #3b4675, #0d1022)" : `linear-gradient(${skyTop}, ${skyBottom})`,
        borderColor: frame,
      }}
    >
      <Sky tod={space ? "night" : tod} space={space} />
      {theme === "lodge" && <SnowMountains />}
      {theme === "train" && <TrainScenery tod={tod} />}
      {theme === "washitsu" && (
        // 障子の桟
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-2">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="border border-[#b08b5c]/50" />
          ))}
        </div>
      )}
      {theme === "classroom" && <div className="absolute inset-x-0 top-1/2 h-1 bg-[#fffaf3]" />}
    </div>
  );
}

function Sky({ tod, space }: { tod: TimeOfDay; space: boolean }) {
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
          <span key={i} className="scene-twinkle absolute h-1 w-1 rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.7}s` }} />
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

/** ロッジの窓：雪山と降る雪 */
function SnowMountains() {
  return (
    <>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3/5 w-full">
        <path d="M0 40 L22 12 L36 26 L55 6 L78 28 L90 18 L100 26 V40 Z" fill="#f4f8fc" />
        <path d="M0 40 L22 12 L28 20 L18 40 Z M55 6 L62 16 L50 40 L44 40 Z" fill="#dfe8f2" />
      </svg>
      {[10, 30, 50, 70, 88].map((x, i) => (
        <span key={x} className="scene-fall absolute top-0 h-1 w-1 rounded-full bg-white" style={{ left: `${x}%`, animationDelay: `${i * 0.9}s`, animationDuration: "5s" }} />
      ))}
    </>
  );
}

/** 列車の窓：流れていく丘と電柱 */
function TrainScenery({ tod }: { tod: TimeOfDay }) {
  const hill = tod === "night" ? "#2b3a4f" : "#8fc47e";
  return (
    <div className="scene-scroll absolute inset-x-0 bottom-0 h-1/2" style={{ "--hill": hill } as CSSProperties}>
      <svg viewBox="0 0 200 20" preserveAspectRatio="none" className="h-full w-[200%]">
        <path d="M0 20 Q25 4 50 12 T100 10 T150 12 T200 10 V20 Z" fill={hill} />
        {[20, 70, 120, 170].map((x) => (
          <rect key={x} x={x} y="2" width="1.2" height="18" fill="#6b5a48" />
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- 窓の左右の飾り

/** スマホでは本棚や掛け軸を小さくして、窓の横に収める */
function DecorSlot({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-14 shrink-0 justify-center sm:w-auto">
      <div className="origin-bottom max-sm:scale-[0.7]">{children}</div>
    </div>
  );
}

function Decor({ theme, side }: { theme: RoomTheme; side: "left" | "right" }) {
  switch (theme) {
    case "library":
    case "night_library":
    case "castle":
      // 本棚（お城は背が高い）
      return (
        <div className={`flex w-16 flex-col justify-around rounded-md bg-[#b08b5c] p-1 ${theme === "castle" ? "h-20 bg-[#6b4029]" : "h-16"}`}>
          {(theme === "castle" ? [0, 1, 2] : [0, 1]).map((row) => (
            <div key={row} className="flex h-5 items-end gap-0.5 rounded-sm bg-[#8d6446] px-0.5">
              {["#e98aa1", "#8fb98b", "#8ec6de", "#e6c88f", "#cdb7e6"].map((c, i) => (
                <span key={i} className="w-1.5 rounded-t-sm" style={{ background: c, height: `${60 + ((i * 7 + row * 13 + (side === "left" ? 0 : 5)) % 40)}%` }} />
              ))}
            </div>
          ))}
          {theme === "night_library" && side === "right" && <span className="scene-flame mx-auto mt-1 h-2 w-3 rounded-full bg-[#ffd98a] shadow-[0_0_12px_6px_rgba(255,217,138,0.5)]" />}
        </div>
      );
    case "cafe":
      return (
        <div className="flex h-16 flex-col items-center">
          <span className="h-8 w-0.5 bg-[#8d6446]" />
          <span className="h-4 w-8 rounded-t-full bg-[#e6c88f]" />
          <span className="h-2 w-6 rounded-full bg-[#fff2b3]/80" />
        </div>
      );
    case "washitsu":
      return (
        <div className="flex h-16 w-8 flex-col items-center rounded-sm bg-[#f8f3e6] py-1 shadow">
          <span className="h-1 w-full bg-[#8d6446]" />
          <span className="mt-2 text-[10px] leading-none text-[#3f3a36] [writing-mode:vertical-rl]">{side === "left" ? "集中" : "一歩"}</span>
        </div>
      );
    case "space":
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#8d96c4] bg-[#1a1f3d]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#8fb98b]" />
        </div>
      );
    case "classroom":
      return side === "left" ? (
        // 黒板
        <div className="flex h-14 w-24 flex-col justify-center gap-1 rounded border-4 border-[#a87b5a] bg-[#3f6b4f] px-2">
          <span className="h-0.5 w-12 bg-white/70" />
          <span className="h-0.5 w-16 bg-white/50" />
          <span className="h-0.5 w-8 bg-white/60" />
        </div>
      ) : (
        // 時計
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#8d6446] bg-white">
          <span className="absolute h-3.5 w-0.5 -translate-y-1.5 bg-[#3f3a36]" />
        </div>
      );
    case "kotatsu":
      return side === "left" ? (
        // みかんのかご
        <div className="flex h-10 w-14 items-end justify-center rounded-b-xl bg-[#c9a574] pb-1">
          <span className="-mb-3 h-4 w-4 rounded-full bg-[#ffa53d]" />
          <span className="-mb-3 h-4 w-4 rounded-full bg-[#ffb34d]" />
          <span className="-mb-1 h-4 w-4 rounded-full bg-[#ff9f2e]" />
        </div>
      ) : (
        <div className="flex h-12 w-10 flex-col items-center">
          <span className="h-8 w-8 rounded-full bg-[#7cbf6a]" />
          <span className="h-4 w-6 rounded-b-md bg-[#d9a066]" />
        </div>
      );
    case "lodge":
      return side === "left" ? (
        // 暖炉
        <div className="flex h-16 w-16 items-end justify-center rounded-t-lg bg-[#8a8178] p-1.5">
          <div className="flex h-9 w-full items-end justify-center rounded-t-md bg-[#2b2522] pb-1">
            <span className="scene-flame h-5 w-4 rounded-full bg-[#ff9c3d] shadow-[0_0_14px_6px_rgba(255,156,61,0.45)]" />
          </div>
        </div>
      ) : (
        <div className="flex h-14 w-10 flex-col items-center gap-0.5">
          <span className="h-3 w-9 rounded bg-[#6e4e34]" />
          <span className="h-3 w-9 rounded bg-[#7a5a3e]" />
          <span className="h-3 w-9 rounded bg-[#6e4e34]" />
        </div>
      );
    case "train":
      // つり革
      return (
        <div className="flex h-16 w-8 flex-col items-center">
          <span className="h-8 w-0.5 bg-[#a89b8c]" />
          <span className="scene-sway h-5 w-5 rounded-full border-[3px] border-[#e8d9b0]" />
        </div>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------- 景色テーマの背景

function SceneBackdrop({ theme, tod }: { theme: RoomTheme; tod: TimeOfDay }) {
  const night = tod === "night";
  const common = "pointer-events-none absolute inset-x-0 top-0 h-36 w-full sm:h-40";
  switch (theme) {
    case "forest":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          {[
            [20, 60, "#5f9a55"],
            [70, 40, "#4f8a45"],
            [130, 70, "#6aa35c"],
            [270, 50, "#4f8a45"],
            [330, 65, "#5f9a55"],
            [380, 45, "#6aa35c"],
          ].map(([x, h, c]) => (
            <g key={x as number}>
              <rect x={(x as number) - 3} y={140 - 25} width="6" height="25" fill="#8d6446" />
              <path d={`M${(x as number) - 24} 118 L${x} ${118 - (h as number) - 40} L${(x as number) + 24} 118 Z`} fill={c as string} />
            </g>
          ))}
          <path d="M150 0 L190 140 M230 0 L210 140" stroke="#fff8d6" strokeWidth="18" opacity="0.18" />
        </svg>
      );
    case "beach":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          <rect y="70" width="400" height="45" fill="#7cc7e6" />
          <rect y="113" width="400" height="27" fill="#f2deb0" />
          <circle cx="320" cy="52" r="14" fill={night ? "#fff6c8" : "#ffe680"} />
          <g className="scene-wave">
            <path d="M-40 112 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#fff" strokeWidth="3" opacity="0.8" />
          </g>
          <path d="M60 140 L68 90" stroke="#8d6446" strokeWidth="3" />
          <path d="M40 92 Q68 70 96 92 Z" fill="#ff8fa3" />
        </svg>
      );
    case "rooftop":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          <path d="M0 110 V80 h30 v-20 h25 v30 h20 v-40 h30 v50 h25 v-25 h30 v35 h40 v-55 h25 v45 h30 v-30 h35 v40 h30 v-20 h35 V110 Z" fill={night ? "#2b3a4f" : "#9fb3c8"} />
          {night && [40, 100, 175, 230, 300].map((x) => <rect key={x} x={x} y="85" width="4" height="4" fill="#ffd98a" />)}
          <g stroke="#7a756e" strokeWidth="3">
            <path d="M0 112 H400" />
            {Array.from({ length: 21 }, (_, i) => (
              <path key={i} d={`M${i * 20} 112 V140`} />
            ))}
            <path d="M0 126 H400" strokeWidth="2" />
          </g>
        </svg>
      );
    case "sakura":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          {[70, 330].map((x) => (
            <g key={x}>
              <rect x={x - 5} y="70" width="10" height="70" fill="#8d6446" />
              <circle cx={x - 30} cy="60" r="34" fill="#ffc7d6" />
              <circle cx={x + 25} cy="55" r="38" fill="#ffd6e0" />
              <circle cx={x} cy="30" r="32" fill="#ffbfd0" />
            </g>
          ))}
          <rect y="128" width="400" height="12" fill="#cfe6b8" />
        </svg>
      );
    case "matsuri":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          {[30, 50, 70, 90, 110].map((y, i) => (
            <circle key={i} cx={40 + i * 80} cy={y - 20} r="1.5" fill="#fff" opacity="0.7" />
          ))}
          <path d="M0 30 Q100 55 200 30 T400 30" fill="none" stroke="#3f3a36" strokeWidth="1.5" />
          {[40, 100, 160, 240, 300, 360].map((x, i) => (
            <g key={x} className="scene-sway" style={{ transformOrigin: `${x}px 36px`, animationDelay: `${i * 0.4}s` }}>
              <ellipse cx={x} cy={46} rx="9" ry="11" fill={i % 2 ? "#ff6b4a" : "#ffd34d"} />
              <rect x={x - 6} y={34} width="12" height="3" fill="#3f3a36" />
            </g>
          ))}
          <path d="M20 140 V100 L60 90 L100 100 V140 Z M300 140 V100 L340 90 L380 100 V140 Z" fill="#8b3a2e" />
          <path d="M20 100 L60 90 L100 100 M300 100 L340 90 L380 100" stroke="#fff" strokeWidth="3" strokeDasharray="8 6" />
        </svg>
      );
    case "greenhouse":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          <g stroke="#b9d9c4" strokeWidth="3">
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M${i * 50} 0 V140`} />
            ))}
            <path d="M0 50 H400 M0 100 H400" />
          </g>
          {[60, 160, 250, 350].map((x) => (
            <g key={x}>
              <path d={`M${x} 0 V30`} stroke="#8d6446" strokeWidth="1.5" />
              <path d={`M${x - 14} 30 h28 l-4 10 h-20 z`} fill="#d9a066" />
              <path d={`M${x - 10} 40 q-6 18 -2 30 M${x} 40 q0 20 2 34 M${x + 10} 40 q6 16 2 28`} stroke="#6aa35c" strokeWidth="3" fill="none" />
            </g>
          ))}
        </svg>
      );
    case "camp":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          {[
            [30, 20],
            [90, 45],
            [150, 15],
            [210, 35],
            [270, 12],
            [330, 40],
            [380, 22],
            [120, 70],
            [250, 65],
          ].map(([x, y], i) => (
            <circle key={i} className="scene-twinkle" cx={x} cy={y} r="1.6" fill="#fff" style={{ animationDelay: `${i * 0.5}s` }} />
          ))}
          <path d="M0 140 V110 Q100 95 200 108 T400 104 V140 Z" fill="#2c3a24" />
          <path d="M70 128 L110 80 L150 128 Z" fill="#e8a33d" />
          <path d="M110 80 L118 128 H102 Z" fill="#b8792a" />
          <g transform="translate(310 126)">
            <path d="M-12 2 h24 M-10 -1 l20 6 M10 -1 l-20 6" stroke="#6e4e34" strokeWidth="3" />
            <path className="scene-flame" d="M0 -18 Q8 -8 5 0 Q0 3 -5 0 Q-8 -8 0 -18 Z" fill="#ff9c3d" style={{ transformOrigin: "0px 0px" }} />
          </g>
        </svg>
      );
    case "aquarium":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          <path d="M80 0 L60 140 M200 0 L190 140 M320 0 L340 140" stroke="#bfe6f5" strokeWidth="22" opacity="0.12" />
          {[30, 110, 260, 370].map((x, i) => (
            <path key={x} className="scene-sway" style={{ transformOrigin: `${x}px 140px`, animationDelay: `${i * 0.6}s` }} d={`M${x} 140 q-8 -20 0 -40 q8 -20 0 -40`} stroke="#3f9a6b" strokeWidth="6" fill="none" strokeLinecap="round" />
          ))}
        </svg>
      );
    case "clouds":
      return (
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className={common} aria-hidden>
          <circle cx="330" cy="28" r="14" fill={night ? "#fff6c8" : "#ffe680"} />
          <g fill="#ffffff">
            <ellipse cx="60" cy="130" rx="80" ry="26" />
            <ellipse cx="200" cy="138" rx="100" ry="26" />
            <ellipse cx="350" cy="130" rx="80" ry="26" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------- 小さな動き

/** 動くものの位置・タイミング（決まった値にして、毎回同じ見た目にする） */
const SPOTS = [
  { x: 8, d: 0, s: 1 },
  { x: 24, d: 2.4, s: 0.8 },
  { x: 41, d: 1.1, s: 1.1 },
  { x: 58, d: 3.3, s: 0.9 },
  { x: 74, d: 0.6, s: 1 },
  { x: 90, d: 2.0, s: 0.85 },
];

function Motion({ kind }: { kind: SceneMotion }) {
  switch (kind) {
    case "petals":
    case "snow":
    case "leaves":
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {SPOTS.map((p, i) => (
            <span
              key={i}
              className="scene-fall absolute -top-3"
              style={{ left: `${p.x}%`, animationDelay: `${p.d}s`, animationDuration: `${9 / p.s}s` }}
            >
              {kind === "snow" ? (
                <span className="block h-1.5 w-1.5 rounded-full bg-white/90" />
              ) : (
                <span
                  className="block h-2 w-3 rounded-[60%_0_60%_0]"
                  style={{ background: kind === "petals" ? "#ffb7c9" : i % 2 ? "#8fb98b" : "#e8b45a" }}
                />
              )}
            </span>
          ))}
        </div>
      );
    case "aquarium":
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[
            { top: 18, c: "#ff9c3d", d: 0, dur: 16, rev: false },
            { top: 34, c: "#ffd34d", d: 5, dur: 20, rev: true },
            { top: 52, c: "#f4a6b8", d: 9, dur: 18, rev: false },
          ].map((f, i) => (
            <span
              key={i}
              className={`absolute ${f.rev ? "scene-swim-rev" : "scene-swim"}`}
              style={{ top: `${f.top}px`, animationDelay: `${f.d}s`, animationDuration: `${f.dur}s` }}
            >
              <svg viewBox="0 0 24 12" width="24" height="12">
                <ellipse cx="9" cy="6" rx="8" ry="5" fill={f.c} />
                <path d="M16 6 L23 1 V11 Z" fill={f.c} />
                <circle cx="5" cy="5" r="1.2" fill="#2b2522" />
              </svg>
            </span>
          ))}
          {SPOTS.slice(0, 4).map((p, i) => (
            <span
              key={`b${i}`}
              className="scene-rise absolute bottom-0 h-2 w-2 rounded-full border border-white/70"
              style={{ left: `${p.x + 3}%`, animationDelay: `${p.d}s`, animationDuration: `${7 / p.s}s` }}
            />
          ))}
        </div>
      );
    case "drift":
      return (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden" aria-hidden>
          {[
            { top: 10, w: 64, d: 0, dur: 60 },
            { top: 40, w: 44, d: 20, dur: 75 },
          ].map((c, i) => (
            <span
              key={i}
              className="scene-drift absolute h-4 rounded-full bg-white/80"
              style={{ top: `${c.top}px`, width: `${c.w}px`, animationDelay: `-${c.d}s`, animationDuration: `${c.dur}s` }}
            />
          ))}
        </div>
      );
    case "butterflies":
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[
            { x: 20, y: 30, c: "#ffd34d", d: 0 },
            { x: 70, y: 50, c: "#c9b2e6", d: 2.5 },
          ].map((b, i) => (
            <span key={i} className="scene-flutter absolute text-[10px]" style={{ left: `${b.x}%`, top: `${b.y}px`, animationDelay: `${b.d}s`, color: b.c }}>
              ◆
            </span>
          ))}
        </div>
      );
    // twinkle・lanterns・flame・scenery・waves は背景の中で動かしている
    default:
      return null;
  }
}
