import type { ReactNode } from "react";
import type { EmoteId } from "@/lib/emotes";

const INK = "#3f3a36";
const S = 2.2;

/** 4つの角のキラキラ */
function Sparkle({ x = 0, y = 0, r = 6, fill = "#ffd34d" }: { x?: number; y?: number; r?: number; fill?: string }) {
  const k = r * 0.28;
  return <path d={`M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r}Z`} fill={fill} stroke="#e0a82e" strokeWidth={1} strokeLinejoin="round" />;
}

function Note({ x, y, fill = INK }: { x: number; y: number; fill?: string }) {
  return (
    <g fill={fill} stroke={fill}>
      <ellipse className="mp-fixed" cx={x} cy={y} rx={3.4} ry={2.6} transform={`rotate(-20 ${x} ${y})`} stroke="none" />
      <path d={`M${x + 3} ${y - 1} V${y - 12} q4 1 5 5`} fill="none" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

function Heart({ x = 0, y = 0, s = 1, fill = "#ff8fa3" }: { x?: number; y?: number; s?: number; fill?: string }) {
  return (
    <path
      className="mp-fixed"
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 7 C-9 0 -8 -7 -3.5 -7 C-1.5 -7 0 -5.5 0 -4 C0 -5.5 1.5 -7 3.5 -7 C8 -7 9 0 0 7Z"
      fill={fill}
      stroke="#e0607a"
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  );
}

/**
 * エモートの記号。座標は (0,0) を中心に ±12 くらいで描き、
 * もちの上では at の位置（もちの 100×100 の座標）に置く。
 */
const MARKS: Record<EmoteId, { at: [number, number]; cls?: string; draw: ReactNode; glyph?: ReactNode }> = {
  wave: {
    at: [88, 36],
    draw: (
      <g fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round">
        <path d="M-3 -8 q6 8 0 16" />
        <path d="M3 -11 q8 11 0 22" />
      </g>
    ),
  },
  bow: { at: [82, 28], draw: <><Sparkle r={7} /><Sparkle x={-9} y={7} r={3.5} /></> },
  nod: {
    at: [50, 20],
    draw: (
      <g fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round">
        <path d="M-10 -2 q3 5 6 0" />
        <path d="M4 -2 q3 5 6 0" />
        <path d="M-4 6 q4 4 8 0" />
      </g>
    ),
  },
  cheer: {
    at: [84, 26],
    draw: (
      <g strokeLinejoin="round">
        <path d="M-6 12 V-12" stroke="#8d6446" strokeWidth={2} strokeLinecap="round" />
        <path d="M-5 -12 L11 -6 L-5 0Z" fill="#e45b5b" stroke="#b83d3d" strokeWidth={1.2} />
        <circle cx={1} cy={-6} r={2} fill="#fff" />
      </g>
    ),
  },
  joy: { at: [50, 20], draw: <><Note x={-26} y={8} /><Note x={26} y={2} /></> },
  stretch: {
    at: [50, 14],
    draw: (
      <g stroke={INK} strokeWidth={S} strokeLinecap="round">
        <path d="M0 4 V-8" />
        <path d="M-9 6 L-14 -4" />
        <path d="M9 6 L14 -4" />
      </g>
    ),
  },
  doze: {
    at: [80, 28],
    draw: (
      <g fill="none" stroke={INK} strokeWidth={S} strokeLinejoin="round" strokeLinecap="round">
        <path className="mochi-zzz" d="M-8 0 h6 l-6 6 h6" />
        <path className="mochi-zzz mochi-zzz-2" d="M1 -10 h8 l-8 8 h8" />
      </g>
    ),
  },
  jiggle: {
    at: [50, 60],
    // 一覧では、ゆれるもちの形で見せる
    glyph: (
      <g fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round">
        <ellipse cx={0} cy={3} rx={7} ry={6} fill="#fff" />
        <path d="M-11 -2 q-2 2 0 4 q2 2 0 4" />
        <path d="M11 -2 q2 2 0 4 q-2 2 0 4" />
      </g>
    ),
    draw: (
      <g fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round">
        <path d="M-44 -6 q-3 3 0 6 q3 3 0 6" />
        <path d="M44 -6 q3 3 0 6 q-3 3 0 6" />
      </g>
    ),
  },
  blush: { at: [82, 30], draw: <Heart s={0.9} /> },
  shock: {
    at: [50, 40],
    draw: (
      <g stroke="#5a6fb0" strokeWidth={S} strokeLinecap="round" opacity={0.85}>
        <path d="M-14 -8 V2" />
        <path d="M-7 -10 V4" />
        <path d="M0 -11 V5" />
        <path d="M7 -10 V4" />
        <path d="M14 -8 V2" />
      </g>
    ),
  },
  relief: {
    at: [24, 30],
    draw: (
      <path
        d="M-9 4 a5 5 0 0 1 2 -9 a6 6 0 0 1 10 -1 a5 5 0 0 1 6 7 a4 4 0 0 1 -4 5 h-11 a4 4 0 0 1 -3 -2Z"
        fill="#fff"
        stroke="#c9bfb3"
        strokeWidth={S}
        strokeLinejoin="round"
      />
    ),
  },
  hungry: {
    at: [82, 26],
    draw: (
      <g strokeLinejoin="round">
        <path d="M0 -10 Q2 -10 10 5 Q11 9 7 9 H-7 Q-11 9 -10 5 Q-2 -10 0 -10Z" fill="#fff" stroke="#c9bfb3" strokeWidth={S} />
        <rect x={-5} y={2} width={10} height={7} fill="#2f3a33" />
      </g>
    ),
  },
  groove: { at: [50, 18], draw: <><Note x={-28} y={6} fill="#e45b8f" /><Note x={4} y={-4} fill="#5b8def" /><Note x={28} y={8} fill="#8fb98b" /></> },
  spin: {
    at: [50, 18],
    draw: (
      <g fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round">
        <path d="M-10 2 a10 6 0 1 0 6 -6" />
        <path d="M-7 -8 l3 4 l-5 2" />
      </g>
    ),
  },
  tall: {
    at: [86, 50],
    draw: (
      <g fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 -12 V12" />
        <path d="M-4 -8 L0 -12 L4 -8" />
        <path d="M-4 8 L0 12 L4 8" />
      </g>
    ),
  },
  idea: {
    at: [50, 18],
    draw: (
      <g strokeLinejoin="round">
        <g stroke="#e0a82e" strokeWidth={1.8} strokeLinecap="round">
          <path d="M-13 -8 l-3 -2" />
          <path d="M13 -8 l3 -2" />
          <path d="M0 -15 v-3" />
        </g>
        <path d="M0 -12 a8 8 0 0 1 5 14 v3 h-10 v-3 a8 8 0 0 1 5 -14Z" fill="#ffe27a" stroke="#e0a82e" strokeWidth={1.6} />
        <rect x={-4.5} y={6} width={9} height={4} rx={1.5} fill="#b8b0a6" />
      </g>
    ),
  },
  sweat: {
    at: [84, 44],
    cls: "mochi-emote-drip",
    draw: <path d="M0 -9 Q7 2 4 6 a5 5 0 0 1 -8 0 Q-7 2 0 -9Z" fill="#8ec6de" stroke="#5a9fc0" strokeWidth={1.4} strokeLinejoin="round" />,
  },
  fire: {
    at: [50, 18],
    cls: "mochi-emote-flicker",
    draw: (
      <g strokeLinejoin="round">
        <path d="M0 -13 C6 -6 11 -2 9 5 a9 9 0 0 1 -18 0 C-10 0 -6 -3 -4 -7 C-3 -3 -1 -2 0 -1 C1 -5 -1 -9 0 -13Z" fill="#ff8a3d" stroke="#e05a2a" strokeWidth={1.4} />
        <path d="M0 -2 C3 1 5 3 4 6 a4 4 0 0 1 -8 0 C-4 3 -2 1 0 -2Z" fill="#ffd34d" />
      </g>
    ),
  },
  hmm: {
    at: [84, 28],
    draw: (
      <g fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M-5 -6 a5 5 0 1 1 6 5 q-1 1 -1 4" />
        <circle cx={0} cy={9} r={0.6} fill={INK} />
      </g>
    ),
  },
  shine: { at: [50, 22], draw: <><Sparkle x={-22} y={4} r={6} /><Sparkle x={0} y={-6} r={8} /><Sparkle x={22} y={4} r={5} /></> },
};

/** もちの上に出す記号（もちの SVG の中に置く） */
export function EmoteMark({ emote }: { emote: EmoteId }) {
  const m = MARKS[emote];
  return (
    <g transform={`translate(${m.at[0]} ${m.at[1]})`}>
      <g className={`mochi-emote-icon ${m.cls ?? ""}`}>{m.draw}</g>
    </g>
  );
}

/** ボタンや一覧で使う、記号だけの小さな絵 */
export function EmoteGlyph({ emote, size = 20, className = "" }: { emote: EmoteId; size?: number; className?: string }) {
  // 横に広い記号（音符・ぷるぷる など）は少し広く切り取る
  const wide = emote === "joy" || emote === "groove" || emote === "shine";
  const vb = wide ? "-34 -16 68 32" : "-14 -14 28 28";
  return (
    <svg viewBox={vb} width={wide ? size * 1.6 : size} height={size} className={className} aria-hidden overflow="visible">
      <g>{MARKS[emote].glyph ?? MARKS[emote].draw}</g>
    </svg>
  );
}
