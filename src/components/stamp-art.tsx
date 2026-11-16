import { useId, type ReactNode } from "react";
import { BodyPaint } from "@/components/mochi";
import { COLORS, DEFAULT_AVATAR, type Avatar } from "@/lib/avatar";
import type { StampId } from "@/lib/stamps";

const INK = "#3f3a36";
const SW = 2.6;

type Face = "dot" | "smile" | "closed" | "sparkle" | "wink";
type Mouth = "w" | "open" | "smile" | "small";

type Pose = {
  face: Face;
  mouth: Mouth;
  /** もちの後ろに描くもの */
  back?: ReactNode;
  /** もちの前に描くもの（手や小物）。hand は手の丸を描く関数 */
  front?: (hand: (x: number, y: number, r?: number) => ReactNode) => ReactNode;
  /** 体の形を変える（おじぎ・のびる） */
  body?: { cy?: number; rx?: number; ry?: number };
  blush?: boolean;
};

function Sparkle({ x, y, r = 6, fill = "#ffd34d" }: { x: number; y: number; r?: number; fill?: string }) {
  const k = r * 0.28;
  return (
    <path
      d={`M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r}Z`}
      fill={fill}
      stroke="#e0a82e"
      strokeWidth={1}
      strokeLinejoin="round"
    />
  );
}

function heartPath(x: number, y: number, s: number) {
  return `M${x} ${y + 7 * s} C${x - 9 * s} ${y} ${x - 8 * s} ${y - 7 * s} ${x - 3.5 * s} ${y - 7 * s} C${x - 1.5 * s} ${y - 7 * s} ${x} ${y - 5.5 * s} ${x} ${y - 4 * s} C${x} ${y - 5.5 * s} ${x + 1.5 * s} ${y - 7 * s} ${x + 3.5 * s} ${y - 7 * s} C${x + 8 * s} ${y - 7 * s} ${x + 9 * s} ${y} ${x} ${y + 7 * s}Z`;
}

const motion = (d: string) => <path d={d} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />;

const POSES: Record<StampId, Pose> = {
  clap: {
    face: "smile",
    mouth: "open",
    front: (hand) => (
      <>
        {hand(45, 78)}
        {hand(55, 76)}
        {motion("M36 70 l-5 -4")}
        {motion("M64 68 l5 -4")}
        {motion("M50 66 v-5")}
      </>
    ),
  },
  ganbare: {
    face: "dot",
    mouth: "open",
    back: <path d="M82 22 v12 M82 38 v1.5" stroke="#e45b5b" strokeWidth={3.2} strokeLinecap="round" />,
    front: (hand) => (
      <>
        <rect x="18" y="45" width="64" height="7" rx="2" fill="#e45b5b" />
        <path d="M80 47 l10 -4 l-2 8Z" fill="#e45b5b" />
        {hand(88, 58, 5.5)}
      </>
    ),
  },
  coffee: {
    face: "smile",
    mouth: "w",
    front: (hand) => (
      <>
        <g fill="none" stroke="#c9bfb3" strokeWidth={2.2} strokeLinecap="round">
          <path d="M70 56 q-2 -4 0 -7 q2 -3 0 -6" />
          <path d="M77 56 q-2 -4 0 -7 q2 -3 0 -6" />
        </g>
        <path d="M66 60 h16 v12 a6 6 0 0 1 -6 6 h-4 a6 6 0 0 1 -6 -6Z" fill="#8d6446" stroke="#6b4a33" strokeWidth={1.6} />
        <path d="M82 63 a4 4 0 0 1 0 8" fill="none" stroke="#6b4a33" strokeWidth={2} />
        {hand(64, 72)}
      </>
    ),
  },
  fight: {
    face: "sparkle",
    mouth: "open",
    back: (
      <g strokeLinejoin="round">
        <path d="M50 8 C62 22 80 26 82 48 C84 70 70 92 50 92 C30 92 16 70 18 48 C20 30 34 28 40 16 C42 26 46 28 48 30 C50 22 48 14 50 8Z" fill="#ff8a3d" stroke="#e05a2a" strokeWidth={2} />
        <path d="M50 30 C58 40 68 46 68 60 C68 74 60 84 50 84 C40 84 32 74 32 60 C32 48 42 44 50 30Z" fill="#ffd34d" />
      </g>
    ),
  },
  nice: {
    face: "wink",
    mouth: "smile",
    front: (hand) => (
      <>
        <circle cx="84" cy="34" r="11" fill="none" stroke="#e45b5b" strokeWidth={4} />
        {hand(76, 56)}
      </>
    ),
  },
  morning: {
    face: "smile",
    mouth: "open",
    back: (
      <g>
        <g stroke="#f2b33d" strokeWidth={3} strokeLinecap="round">
          <path d="M22 6 v6" />
          <path d="M6 22 h6" />
          <path d="M10 10 l4 4" />
          <path d="M34 10 l-4 4" />
        </g>
        <circle cx="22" cy="24" r="10" fill="#ffd34d" stroke="#f2b33d" strokeWidth={2} />
      </g>
    ),
  },
  night: {
    face: "closed",
    mouth: "small",
    back: <path d="M86 14 a10 10 0 1 0 6 18 a8 8 0 0 1 -6 -18Z" fill="#ffe27a" stroke="#e0a82e" strokeWidth={1.6} />,
    front: () => (
      <g strokeLinejoin="round">
        <path d="M28 42 Q46 30 70 40 Q66 22 52 14 Q40 18 28 42Z" fill="#5b6fb0" stroke="#45579a" strokeWidth={2} />
        <circle cx="52" cy="13" r="4.5" fill="#fff" stroke="#c9bfb3" strokeWidth={1.4} />
        <path d="M26 44 Q48 32 72 42" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      </g>
    ),
  },
  otsukare: {
    face: "closed",
    mouth: "w",
    front: (hand) => (
      <>
        <g fill="none" stroke="#c9bfb3" strokeWidth={2.2} strokeLinecap="round">
          <path d="M46 66 q-2 -3 0 -6 q2 -3 0 -6" />
          <path d="M54 66 q-2 -3 0 -6 q2 -3 0 -6" />
        </g>
        <rect x="41" y="70" width="18" height="14" rx="4" fill="#8fb98b" stroke="#6e9a6a" strokeWidth={1.4} />
        {hand(40, 79)}
        {hand(60, 79)}
      </>
    ),
  },
  thanks: {
    face: "closed",
    mouth: "small",
    body: { cy: 68, rx: 36, ry: 22 },
    back: <path d={heartPath(80, 26, 1.3)} fill="#ff8fa3" stroke="#e0607a" strokeWidth={1.4} strokeLinejoin="round" />,
  },
  wow: {
    face: "sparkle",
    mouth: "open",
    back: (
      <>
        <Sparkle x={14} y={24} r={7} />
        <Sparkle x={86} y={20} r={8} />
        <Sparkle x={90} y={44} r={4} />
      </>
    ),
  },
  wakaru: {
    face: "closed",
    mouth: "smile",
    back: (
      <g fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round">
        <path d="M30 22 q4 6 8 0" />
        <path d="M62 22 q4 6 8 0" />
        <path d="M46 14 q4 6 8 0" />
      </g>
    ),
  },
  focus: {
    face: "dot",
    mouth: "small",
    front: (hand) => (
      <>
        <g fill="none" stroke={INK} strokeWidth={2.2}>
          <circle cx="39" cy="62" r="7" />
          <circle cx="61" cy="62" r="7" />
          <path d="M46 62 h8" />
        </g>
        <path d="M30 78 L50 82 L70 78 V92 L50 96 L30 92Z" fill="#fff" stroke="#8ec6de" strokeWidth={2} strokeLinejoin="round" />
        <path d="M50 82 V96" stroke="#8ec6de" strokeWidth={1.6} />
        {hand(30, 86)}
        {hand(70, 86)}
      </>
    ),
  },
  pat: {
    face: "closed",
    mouth: "w",
    blush: true,
    front: (hand) => (
      <>
        {hand(50, 30, 7)}
        {motion("M36 26 q-4 -6 0 -10")}
        {motion("M64 26 q4 -6 0 -10")}
      </>
    ),
  },
  dango: {
    face: "smile",
    mouth: "open",
    front: (hand) => (
      <>
        <path d="M80 14 V72" stroke="#b08b5c" strokeWidth={2.4} strokeLinecap="round" />
        {/* 三色だんご：桃・白・緑がはっきり分かるよう、色を濃いめにして縁取りも太くする */}
        <circle cx="80" cy="24" r="7.5" fill="#f07a9b" stroke="#c24f70" strokeWidth={2} />
        <circle cx="80" cy="39" r="7.5" fill="#ffffff" stroke="#9b8f80" strokeWidth={2} />
        <circle cx="80" cy="54" r="7.5" fill="#6aa84f" stroke="#477a33" strokeWidth={2} />
        {hand(80, 70)}
      </>
    ),
  },
  heart: {
    face: "smile",
    mouth: "w",
    blush: true,
    front: (hand) => (
      <>
        <path d={heartPath(50, 80, 2)} fill="#ff8fa3" stroke="#e0607a" strokeWidth={2} strokeLinejoin="round" />
        {hand(33, 78)}
        {hand(67, 78)}
      </>
    ),
  },
  nebare: {
    face: "dot",
    mouth: "open",
    body: { cy: 58, rx: 26, ry: 36 },
    back: (
      <g fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round">
        <path d="M14 30 q-4 8 0 16" />
        <path d="M86 30 q4 8 0 16" />
      </g>
    ),
    front: (hand) => (
      <>
        {hand(20, 14)}
        {hand(80, 14)}
      </>
    ),
  },
  hanamaru: {
    face: "smile",
    mouth: "open",
    back: (
      <g fill="none" stroke="#e45b5b" strokeWidth={3.4} strokeLinecap="round">
        <path d="M50 8 C82 6 98 40 86 70 C74 98 22 98 10 66 C0 38 20 10 52 14 C70 16 80 28 78 40" />
        <path d="M78 40 q8 -2 10 -10 M78 40 q-2 -9 -10 -12" />
      </g>
    ),
  },
  congrats: {
    face: "sparkle",
    mouth: "open",
    back: (
      <g>
        <rect x="14" y="16" width="6" height="3" fill="#8ec6de" transform="rotate(30 17 17)" className="mp-fixed" />
        <rect x="30" y="6" width="6" height="3" fill="#f4a6b8" transform="rotate(-20 33 7)" className="mp-fixed" />
        <rect x="58" y="4" width="6" height="3" fill="#8fb98b" transform="rotate(15 61 5)" className="mp-fixed" />
        <circle cx="48" cy="14" r="2.4" fill="#cdb7e6" />
        <circle cx="22" cy="32" r="2" fill="#ffd34d" />
      </g>
    ),
    front: (hand) => (
      <>
        <path d="M70 70 L92 52 L80 82Z" fill="#ffd34d" stroke="#e0a82e" strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M76 66 l8 6 M72 72 l6 6" stroke="#e45b5b" strokeWidth={2} />
        {motion("M90 44 l4 -6")}
        {motion("M96 54 l6 -2")}
        {hand(72, 78)}
      </>
    ),
  },
  daruma: {
    face: "dot",
    mouth: "small",
    front: () => (
      <g>
        <ellipse cx="80" cy="76" rx="16" ry="17" fill="#e45b5b" stroke="#b83d3d" strokeWidth={1.8} />
        <ellipse cx="80" cy="72" rx="9" ry="8" fill="#fff8ec" />
        <circle cx="77" cy="71" r="1.8" fill={INK} />
        <circle cx="83" cy="71" r="1.8" fill="none" stroke={INK} strokeWidth={1.2} />
        <path d="M77 76 q3 2 6 0" fill="none" stroke={INK} strokeWidth={1.2} />
        <path d="M74 86 h12" stroke="#ffd34d" strokeWidth={2} />
      </g>
    ),
  },
  crown: {
    face: "sparkle",
    mouth: "smile",
    back: (
      <>
        <Sparkle x={12} y={30} r={6} />
        <Sparkle x={88} y={28} r={6} />
      </>
    ),
    front: () => (
      <g strokeLinejoin="round">
        <path d="M32 40 L30 18 L41 28 L50 14 L59 28 L70 18 L68 40Z" fill="#ffd34d" stroke="#e0a82e" strokeWidth={2} />
        <circle cx="50" cy="31" r="3" fill="#e45b5b" />
      </g>
    ),
  },
};

function Eyes({ face, ink }: { face: Face; ink: string }) {
  const line = { fill: "none", stroke: ink, strokeWidth: SW, strokeLinecap: "round" as const };
  switch (face) {
    case "smile":
      return (
        <g {...line}>
          <path d="M34 62 q5 -6 10 0" />
          <path d="M56 62 q5 -6 10 0" />
        </g>
      );
    case "closed":
      return (
        <g {...line}>
          <path d="M34 60 q5 5 10 0" />
          <path d="M56 60 q5 5 10 0" />
        </g>
      );
    case "wink":
      return (
        <g>
          <circle cx="39" cy="60" r="3.2" fill={ink} />
          <path d="M56 62 q5 -6 10 0" {...line} />
        </g>
      );
    case "sparkle":
      return (
        <g>
          <circle cx="39" cy="60" r="4.4" fill={ink} />
          <circle cx="61" cy="60" r="4.4" fill={ink} />
          <circle cx="40.5" cy="58.4" r="1.6" fill="#fff" />
          <circle cx="62.5" cy="58.4" r="1.6" fill="#fff" />
        </g>
      );
    default:
      return (
        <g fill={ink}>
          <circle cx="39" cy="60" r="3.2" />
          <circle cx="61" cy="60" r="3.2" />
        </g>
      );
  }
}

function MouthShape({ mouth, ink }: { mouth: Mouth; ink: string }) {
  const line = { fill: "none", stroke: ink, strokeWidth: SW, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (mouth) {
    case "open":
      return <path d="M45 69 q5 8 10 0Z" fill="#e0607a" stroke={ink} strokeWidth={2} strokeLinejoin="round" />;
    case "smile":
      return <path d="M44 69 q6 5 12 0" {...line} />;
    case "small":
      return <circle cx="50" cy="70" r="1.8" fill={ink} />;
    default:
      return <path d="M44 68 q3 4 6 0 q3 4 6 0" {...line} />;
  }
}

/**
 * スタンプの絵。送った人のもち（体の色）がポーズをとる。
 * 100×100 の座標で描く。
 */
export function StampArt({ id, avatar = DEFAULT_AVATAR, size = 40, className = "" }: { id: StampId; avatar?: Avatar; size?: number; className?: string }) {
  const pose = POSES[id];
  const color = COLORS[avatar.color] ?? COLORS.shiro;
  const ink = color.dark ? "#fff8ec" : INK;
  const cy = pose.body?.cy ?? 64;
  const rx = pose.body?.rx ?? 32;
  const ry = pose.body?.ry ?? 26;
  const hand = (x: number, y: number, r = 4.8) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={color.fill} stroke={color.edge} strokeWidth={SW} />;
  // 色が上下に分かれている・グラデーションの体は、もちと同じように塗り分ける
  const paintId = `stamp-paint-${useId().replace(/:/g, "")}`;
  const fill = color.paint ? `url(#${paintId})` : color.fill;
  // 顔の位置は体の中心に合わせて上下させる
  const faceDy = cy - 64;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden overflow="visible">
      {color.paint && (
        <defs>
          <BodyPaint id={paintId} paint={color.paint} />
        </defs>
      )}
      {pose.back}
      <ellipse cx="50" cy={cy} rx={rx} ry={ry} fill={fill} stroke={color.edge} strokeWidth={SW} />
      <g transform={`translate(0 ${faceDy})`}>
        {pose.blush && (
          <g fill="#ff8fa3" opacity={0.7}>
            <ellipse cx="29" cy="68" rx="5" ry="3" />
            <ellipse cx="71" cy="68" rx="5" ry="3" />
          </g>
        )}
        <Eyes face={pose.face} ink={ink} />
        <MouthShape mouth={pose.mouth} ink={ink} />
      </g>
      {pose.front?.(hand)}
    </svg>
  );
}
