/**
 * ショップで買える、もちの目・口・ほっぺ（2回目の30種ずつ）。
 * もちの SVG（viewBox 0 0 100 100）の座標で描く。目は (38,60)・(62,60)、口は (50,68)、
 * ほっぺは (29,68)・(71,68) が中心。線の太さはなるべく STROKE にそろえる（少しなら崩してよい）。
 */
import type { ReactNode } from "react";

const STROKE = 2.6;
const L = 38;
const R = 62;
const Y = 60;

// ---------------------------------------------------------------- 形の部品

export function heartPath(cx: number, cy: number, s: number): string {
  return `M${cx} ${cy + s * 0.9} C${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.9} ${cy - s * 1.4} ${cx} ${cy - s * 0.5} C${cx + s * 0.9} ${cy - s * 1.4} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;
}

export function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")}Z`;
}

function sparklePath(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`;
}

function dropPath(cx: number, cy: number, s: number): string {
  return `M${cx} ${cy - s} C${cx + s * 0.9} ${cy} ${cx + s * 0.7} ${cy + s} ${cx} ${cy + s} C${cx - s * 0.7} ${cy + s} ${cx - s * 0.9} ${cy} ${cx} ${cy - s}Z`;
}

const line = (ink: string, width = STROKE) => ({
  fill: "none",
  stroke: ink,
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/** 左右の目に同じものを描く。mirror は右目のとき 1、左目のとき -1（外側の向き） */
function bothEyes(draw: (x: number, mirror: 1 | -1) => ReactNode) {
  return (
    <>
      <g>{draw(L, -1)}</g>
      <g>{draw(R, 1)}</g>
    </>
  );
}

function bothCheeks(draw: (x: number, mirror: 1 | -1) => ReactNode) {
  return (
    <>
      <g>{draw(29, -1)}</g>
      <g>{draw(71, 1)}</g>
    </>
  );
}

// ---------------------------------------------------------------- 目

export const EXTRA_EYES = new Set([
  "chibi", "tare", "tsuri", "manmaru", "hoso", "hohoemi", "jito", "usagi", "wink", "bikkuri",
  "gyu", "toron", "uruuru", "guruguru", "shiitake", "kiri", "komari", "oko", "namida", "heart",
  "star", "neko", "pacchiri", "marumegane", "sunglasses", "monocle", "shoujo", "goggles", "diamond", "nijiiro",
]);

export function ExtraEyes({ kind, ink, uid }: { kind: string; ink: string; uid: string }): ReactNode {
  const dot = (x: number, r = 3.4) => <circle cx={x} cy={Y} r={r} fill={ink} />;
  switch (kind) {
    case "chibi":
      return bothEyes((x) => dot(x, 2));
    case "tare":
      return bothEyes((x, m) => <path d={`M${x - 4 * m} ${Y + 2.5} Q${x} ${Y - 3} ${x + 4 * m} ${Y - 1}`} {...line(ink)} />);
    case "tsuri":
      return bothEyes((x, m) => <path d={`M${x - 4 * m} ${Y - 2.5} Q${x} ${Y + 2} ${x + 4 * m} ${Y + 1.5}`} {...line(ink)} />);
    case "manmaru":
      return bothEyes((x) => (
        <>
          <circle cx={x} cy={Y} r="4.8" fill={ink} />
          <circle cx={x - 1.6} cy={Y - 1.7} r="1.5" fill="#fff" />
        </>
      ));
    case "hoso":
      return bothEyes((x) => <path d={`M${x - 4.5} ${Y} h9`} {...line(ink)} />);
    case "hohoemi":
      return bothEyes((x) => <path d={`M${x - 3.5} ${Y + 1} q3.5 -3 7 0`} {...line(ink)} />);
    case "jito":
      return bothEyes((x) => (
        <>
          <path d={`M${x - 4.5} ${Y - 1} h9`} {...line(ink)} />
          <path d={`M${x - 3} ${Y - 0.5} a3 3 0 0 0 6 0 z`} fill={ink} />
        </>
      ));
    case "usagi":
      return bothEyes((x) => (
        <>
          <circle cx={x} cy={Y} r="3.4" fill="#e0475a" />
          <circle cx={x - 1} cy={Y - 1.1} r="1" fill="#fff" />
        </>
      ));
    case "wink":
      return (
        <>
          {dot(L)}
          <path d={`M${R - 4} ${Y + 1} q4 -4 8 0`} {...line(ink)} />
        </>
      );
    case "bikkuri":
      return bothEyes((x) => (
        <>
          <circle cx={x} cy={Y} r="5" fill="#fff" stroke={ink} strokeWidth={STROKE * 0.8} />
          <circle cx={x} cy={Y} r="1.5" fill={ink} />
        </>
      ));
    case "gyu":
      return (
        <>
          <path d={`M${L - 3.5} ${Y - 3.5} l7 3.5 l-7 3.5`} {...line(ink)} />
          <path d={`M${R + 3.5} ${Y - 3.5} l-7 3.5 l7 3.5`} {...line(ink)} />
        </>
      );
    case "toron":
      return bothEyes((x, m) => (
        <>
          <path d={`M${x - 4.5 * m} ${Y - 1} Q${x} ${Y - 2} ${x + 4.5 * m} ${Y + 1}`} {...line(ink)} />
          <path d={`M${x - 3} ${Y} a3 2.6 0 0 0 6 0 z`} fill={ink} />
        </>
      ));
    case "uruuru":
      return bothEyes((x) => (
        <>
          <circle cx={x} cy={Y} r="5.2" fill={ink} />
          <circle cx={x - 1.8} cy={Y - 2} r="1.9" fill="#fff" />
          <circle cx={x + 1.8} cy={Y + 1.2} r="1" fill="#fff" />
          <path d={`M${x - 3.2} ${Y + 3.4} q3.2 1.6 6.4 0`} fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        </>
      ));
    case "guruguru":
      return bothEyes((x) => (
        <path
          d={`M${x} ${Y} m-0.8 0 a0.8 0.8 0 1 1 1.6 0 a1.8 1.8 0 1 1 -3.6 0 a2.8 2.8 0 1 1 5.6 0 a3.8 3.8 0 1 1 -7.6 0`}
          {...line(ink, 1.6)}
        />
      ));
    case "shiitake":
      return bothEyes((x) => (
        <>
          <circle cx={x} cy={Y} r="4.4" fill={ink} />
          <path d={`M${x - 2.4} ${Y} h4.8 M${x} ${Y - 2.4} v4.8`} stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ));
    case "kiri":
      return bothEyes((x, m) => (
        <>
          {dot(x)}
          <path d={`M${x - 5 * m} ${Y - 7} L${x + 3.5 * m} ${Y - 9}`} {...line(ink, 3)} />
        </>
      ));
    case "komari":
      return bothEyes((x, m) => (
        <>
          {dot(x)}
          <path d={`M${x + 5 * m} ${Y - 6.5} L${x - 3.5 * m} ${Y - 9.5}`} {...line(ink)} />
        </>
      ));
    case "oko":
      return bothEyes((x, m) => (
        <>
          {dot(x)}
          <path d={`M${x + 5 * m} ${Y - 10} L${x - 3.5 * m} ${Y - 6.5}`} {...line(ink)} />
        </>
      ));
    case "namida":
      return bothEyes((x, m) => (
        <>
          {dot(x)}
          <path d={dropPath(x + 2.5 * m, Y + 7, 2.4)} fill="#8ec6de" />
        </>
      ));
    case "heart":
      return bothEyes((x) => <path d={heartPath(x, Y, 4)} fill="#ff6b8a" />);
    case "star":
      return bothEyes((x) => <path d={starPath(x, Y, 4.8)} fill={ink} />);
    case "neko":
      return bothEyes((x) => (
        <>
          <ellipse cx={x} cy={Y} rx="4.2" ry="4.6" fill="#c9e265" stroke={ink} strokeWidth="1.2" />
          <ellipse cx={x} cy={Y} rx="1.2" ry="3.8" fill={ink} />
        </>
      ));
    case "pacchiri":
      return bothEyes((x, m) => (
        <>
          <circle cx={x} cy={Y} r="3.8" fill={ink} />
          <circle cx={x - 1.2} cy={Y - 1.3} r="1.2" fill="#fff" />
          <path
            d={`M${x + 2.5 * m} ${Y - 3} l${2.2 * m} -2.4 M${x + 3.6 * m} ${Y - 1.2} l${2.6 * m} -1.2 M${x + 1} ${Y - 3.8} l${0.6 * m} -2.6`}
            {...line(ink, 1.4)}
          />
        </>
      ));
    case "marumegane":
      return (
        <>
          {dot(L, 2.6)}
          {dot(R, 2.6)}
          <g {...line(ink, 2)}>
            <circle cx={L} cy={Y} r="9" />
            <circle cx={R} cy={Y} r="9" />
            <path d={`M${L + 9} ${Y - 1} q${(R - L - 18) / 2} -2 ${R - L - 18} 0`} />
          </g>
        </>
      );
    case "sunglasses":
      return (
        <>
          <rect x={L - 8} y={Y - 5} width="16" height="10" rx="4" fill="#2d2a33" />
          <rect x={R - 8} y={Y - 5} width="16" height="10" rx="4" fill="#2d2a33" />
          <path d={`M${L + 8} ${Y - 2} h${R - L - 16}`} stroke="#2d2a33" strokeWidth="2.2" />
          <path d={`M${L - 5} ${Y - 2.5} l3 0 M${R - 5} ${Y - 2.5} l3 0`} stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        </>
      );
    case "monocle":
      return (
        <>
          {dot(L)}
          {dot(R, 2.8)}
          <circle cx={R} cy={Y} r="7.5" fill="#fff" fillOpacity="0.25" stroke="#c9962a" strokeWidth="2.2" />
          <path d={`M${R + 6} ${Y + 4} q4 8 -2 16`} fill="none" stroke="#c9962a" strokeWidth="1.2" />
        </>
      );
    case "shoujo":
      return bothEyes((x) => (
        <>
          <ellipse cx={x} cy={Y} rx="4.6" ry="5.8" fill={ink} />
          <ellipse cx={x} cy={Y + 2} rx="3" ry="2.6" fill="#7b6bd1" opacity="0.8" />
          <circle cx={x - 1.6} cy={Y - 2.4} r="1.9" fill="#fff" />
          <circle cx={x + 1.8} cy={Y + 1.8} r="0.9" fill="#fff" />
          <path d={sparklePath(x + 1.6, Y - 2.8, 1.4)} fill="#fff" />
        </>
      ));
    case "goggles":
      return (
        <>
          <rect x="14" y={Y - 3} width="72" height="6" rx="3" fill="#5b8def" opacity="0.85" />
          {[L, R].map((x) => (
            <g key={x}>
              <circle cx={x} cy={Y} r="7.5" fill="#bfe6f5" fillOpacity="0.85" stroke="#5b8def" strokeWidth="2.4" />
              <circle cx={x} cy={Y} r="2.4" fill={ink} />
              <path d={`M${x - 4} ${Y - 3} q2 -2 4 -2`} fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          ))}
        </>
      );
    case "diamond":
      return bothEyes((x) => (
        <>
          <path d={`M${x} ${Y - 5.5} L${x + 4.5} ${Y} L${x} ${Y + 5.5} L${x - 4.5} ${Y} Z`} fill="#8ec6de" stroke={ink} strokeWidth="1.2" />
          <path d={`M${x - 4.5} ${Y} h9 M${x} ${Y - 5.5} L${x - 1.6} ${Y} L${x} ${Y + 5.5}`} fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.8" />
        </>
      ));
    case "nijiiro":
      return (
        <>
          <defs>
            <linearGradient id={`niji-eye-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff9aa2" />
              <stop offset="0.3" stopColor="#ffd27f" />
              <stop offset="0.55" stopColor="#9fe3b8" />
              <stop offset="0.8" stopColor="#8ec6f5" />
              <stop offset="1" stopColor="#c7a6f0" />
            </linearGradient>
          </defs>
          {bothEyes((x) => (
            <>
              <circle cx={x} cy={Y} r="5" fill={`url(#niji-eye-${uid})`} stroke={ink} strokeWidth="1.4" />
              <circle cx={x} cy={Y} r="1.8" fill={ink} />
              <circle cx={x - 1.8} cy={Y - 2} r="1.2" fill="#fff" />
            </>
          ))}
        </>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------- 口

export const EXTRA_MOUTHS = new Set([
  "ni", "ho", "musu", "pokan", "unya", "niyari", "shobon", "puku", "pero", "chu",
  "waai", "akubi", "mogumogu", "gaan", "giza", "kiba", "usagi", "fuu", "ahiru", "nikko",
  "tehe", "nekoguchi", "chobihige", "mask", "kaiser", "oshaburi", "pan", "hana", "kira", "heart",
]);

const TONGUE = "#ff8fa3";

export function ExtraMouth({ kind, ink }: { kind: string; ink: string }): ReactNode {
  switch (kind) {
    case "ni":
      return <path d="M45 68 h10" {...line(ink)} />;
    case "ho":
      return <circle cx="50" cy="68.5" r="2.2" {...line(ink, 2)} />;
    case "musu":
      return <path d="M47.5 69 h5" {...line(ink)} />;
    case "pokan":
      return <ellipse cx="50" cy="69" rx="3.2" ry="2.6" fill={ink} />;
    case "unya":
      return <path d="M44 68.5 q2 -2.5 4 0 q2 2.5 4 0 q2 -2.5 4 0" {...line(ink)} />;
    case "niyari":
      return <path d="M45 68 q6 3.5 10.5 -2" {...line(ink)} />;
    case "shobon":
      return <path d="M47 70 q3 -3 6 0" {...line(ink)} />;
    case "puku":
      return (
        <>
          <path d="M48.5 68 q1.5 -1.6 3 0" {...line(ink)} />
          <circle cx="61" cy="68" r="4.5" fill="#ffd2dc" opacity="0.6" />
        </>
      );
    case "pero":
      return (
        <>
          <ellipse cx="51.5" cy="70.6" rx="2.4" ry="2.2" fill={TONGUE} />
          <path d="M45 67 q5 4.5 10 0" {...line(ink)} />
        </>
      );
    case "chu":
      return <path d="M48.5 65.5 q3 1.5 0 3 q3 1.5 0 3" {...line(ink)} />;
    case "waai":
      return (
        <>
          <path d="M44.5 66 h11 q0 7 -5.5 7 q-5.5 0 -5.5 -7 z" fill={ink} />
          <ellipse cx="50" cy="71" rx="2.8" ry="1.5" fill={TONGUE} />
        </>
      );
    case "akubi":
      return (
        <>
          <ellipse cx="50" cy="69" rx="2.8" ry="4.2" fill={ink} />
          <ellipse cx="50" cy="71.3" rx="1.6" ry="1.2" fill={TONGUE} />
        </>
      );
    case "mogumogu":
      return (
        <>
          <path d="M45.5 68 q2.2 2 4.5 0 q2.2 -2 4.5 0" {...line(ink)} />
          <circle cx="62" cy="67" r="4.2" fill="#ffd2dc" opacity="0.55" />
          <circle cx="38" cy="67" r="4.2" fill="#ffd2dc" opacity="0.55" />
        </>
      );
    case "gaan":
      return <rect x="47.8" y="64" width="4.4" height="9" rx="2.2" fill={ink} />;
    case "giza":
      return <path d="M43.5 69.5 l3.2 -3 l3.2 3 l3.2 -3 l3.2 3" {...line(ink)} />;
    case "kiba":
      return (
        <>
          <path d="M45 67 q5 4.5 10 0" {...line(ink)} />
          <path d="M51.5 68.6 l1.2 2.6 l1.2 -3" fill="#fff" stroke={ink} strokeWidth="0.9" strokeLinejoin="round" />
        </>
      );
    case "usagi":
      return (
        <>
          <path d="M46 66.5 q4 3 8 0" {...line(ink)} />
          <rect x="48" y="67.6" width="4" height="3.6" rx="0.8" fill="#fff" stroke={ink} strokeWidth="0.9" />
          <path d="M50 67.8 v3.2" stroke={ink} strokeWidth="0.8" />
        </>
      );
    case "fuu":
      return (
        <>
          <circle cx="49" cy="68.5" r="1.9" fill={ink} />
          <path d="M54 67 q1.5 -1.5 3 0 q1.5 1.5 3 0" {...line(ink, 1.6)} />
        </>
      );
    case "ahiru":
      return <path d="M45 69.5 q2.5 -3.5 5 -1.2 q2.5 -2.3 5 1.2" {...line(ink)} />;
    case "nikko":
      return (
        <>
          <path d="M44 66 h12 q0 6.5 -6 6.5 q-6 0 -6 -6.5 z" fill="#fff" stroke={ink} strokeWidth={STROKE * 0.8} strokeLinejoin="round" />
          <path d="M45.2 68.6 h9.6" stroke={ink} strokeWidth="0.8" opacity="0.5" />
        </>
      );
    case "tehe":
      return (
        <>
          <ellipse cx="54" cy="69.6" rx="2.2" ry="2" fill={TONGUE} />
          <path d="M45.5 67 q4.5 3.5 9 0" {...line(ink)} />
        </>
      );
    case "nekoguchi":
      return (
        <>
          <path d="M44 67 q3 4 6 0 q3 4 6 0" {...line(ink)} />
          <g {...line(ink, 1.2)}>
            <path d="M20 63 l10 2 M19 67 h11 M20 71 l10 -2" />
            <path d="M80 63 l-10 2 M81 67 h-11 M80 71 l-10 -2" />
          </g>
        </>
      );
    case "chobihige":
      return (
        <>
          <path d="M44 66 q3 -3.5 6 -0.6 q3 -2.9 6 0.6 q-3 1.6 -6 0 q-3 1.6 -6 0 z" fill={ink} />
          <path d="M47.5 70.5 h5" {...line(ink, 2)} />
        </>
      );
    case "mask":
      return (
        <>
          <path d="M26 63 q-4 3 0 8 M74 63 q4 3 0 8" fill="none" stroke="#d9d0c4" strokeWidth="1.4" />
          <rect x="33" y="62" width="34" height="14" rx="6" fill="#fff" stroke="#d9d0c4" strokeWidth="1.6" />
          <path d="M37 66.5 h26 M37 70.5 h26" stroke="#e8e0d6" strokeWidth="1.2" />
        </>
      );
    case "kaiser":
      return (
        <>
          <path d="M50 66 q-5 -3 -10 0 q-3 2 -1 -1.5 M50 66 q5 -3 10 0 q3 2 1 -1.5" {...line(ink)} />
          <path d="M47.5 70.5 h5" {...line(ink, 2)} />
        </>
      );
    case "oshaburi":
      return (
        <>
          <ellipse cx="50" cy="69" rx="7" ry="4.5" fill="#a0d2f0" stroke="#7cb5d9" strokeWidth="1.4" />
          <circle cx="50" cy="69" r="2.6" fill="none" stroke="#fff" strokeWidth="1.6" />
        </>
      );
    case "pan":
      return (
        <g className="mp-fixed" transform="rotate(12 56 69)">
          <rect x="47" y="63" width="16" height="12" rx="3.5" fill="#ffe2a3" stroke="#d4a256" strokeWidth="2" />
          <path d="M50 67 h10" stroke="#f0cf86" strokeWidth="1" />
        </g>
      );
    case "hana":
      return (
        <>
          <path d="M50 68.5 L63 62" stroke="#6aa35c" strokeWidth="1.8" strokeLinecap="round" />
          <g className="mp-fixed" transform="translate(65 61)">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse className="mp-fixed" key={a} cx="0" cy="-3" rx="2" ry="3" fill="#ff9fb3" transform={`rotate(${a})`} />
            ))}
            <circle r="1.6" fill="#ffd34d" />
          </g>
          <path d="M46 68.5 h4" {...line(ink, 2)} />
        </>
      );
    case "kira":
      return (
        <>
          <path d="M44 66 h12 q0 6.5 -6 6.5 q-6 0 -6 -6.5 z" fill="#fff" stroke={ink} strokeWidth={STROKE * 0.8} strokeLinejoin="round" />
          <path d={sparklePath(59, 63.5, 3.2)} fill="#ffd34d" />
        </>
      );
    case "heart":
      return <path d={heartPath(50, 68.5, 3.2)} fill="#ff6b8a" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- ほっぺ

export const EXTRA_CHEEKS = new Set([
  "usupink", "aka", "mizuiro", "murasaki", "midori", "kiiro", "chiisai", "hokuro", "ookii", "tate",
  "yoko", "tere", "sobakasu", "fuwa", "guruguru", "shizuku", "ase", "star", "bandage", "nekohige",
  "happa", "oko", "heart", "kirakira", "sakura", "yuki", "onpu", "ichigo", "sticker", "niji",
]);

const PINK = "#ff9fb3";

export function ExtraCheeks({ kind, ink, uid }: { kind: string; ink: string; uid: string }): ReactNode {
  const oval = (fill: string, rx = 5.5, ry = 3.4, opacity = 0.65) =>
    bothCheeks((x) => <ellipse cx={x} cy={68} rx={rx} ry={ry} fill={fill} opacity={opacity} />);
  switch (kind) {
    case "usupink":
      return oval("#ffc4d0", 5.5, 3.4, 0.75);
    case "aka":
      return oval("#ff7b7b", 5.5, 3.4, 0.6);
    case "mizuiro":
      return oval("#9fd6f5", 5.5, 3.4, 0.75);
    case "murasaki":
      return oval("#c9b2e6", 5.5, 3.4, 0.8);
    case "midori":
      return oval("#b6e3a0", 5.5, 3.4, 0.8);
    case "kiiro":
      return oval("#ffe27a", 5.5, 3.4, 0.85);
    case "chiisai":
      return oval(PINK, 3.2, 2, 0.7);
    case "hokuro":
      return <circle cx="32" cy="70" r="1.2" fill={ink} />;
    case "ookii":
      return oval("#ffb3c1", 8, 5, 0.6);
    case "tate":
      return oval(PINK, 3.4, 5, 0.65);
    case "yoko":
      return oval(PINK, 8, 2.6, 0.65);
    case "tere":
      return bothCheeks((x) => <path d={`M${x - 4} ${70} l2.5 -4 M${x - 0.8} ${70} l2.5 -4 M${x + 2.4} ${70} l2.5 -4`} {...line("#ff7b8a", 1.4)} />);
    case "sobakasu":
      return bothCheeks((x) => (
        <g fill="#b07a55">
          <circle cx={x - 2.5} cy={67} r="0.9" />
          <circle cx={x + 1} cy={66.2} r="0.9" />
          <circle cx={x - 0.5} cy={69.3} r="0.9" />
        </g>
      ));
    case "fuwa":
      return (
        <>
          <defs>
            <radialGradient id={`fuwa-${uid}`}>
              <stop offset="0" stopColor="#ff8fa8" stopOpacity="0.8" />
              <stop offset="1" stopColor="#ff8fa8" stopOpacity="0" />
            </radialGradient>
          </defs>
          {bothCheeks((x) => <ellipse cx={x} cy={68} rx="8" ry="5.5" fill={`url(#fuwa-${uid})`} />)}
        </>
      );
    case "guruguru":
      return bothCheeks((x) => (
        <path d={`M${x} ${68} m-0.8 0 a0.8 0.8 0 1 1 1.6 0 a1.8 1.8 0 1 1 -3.6 0 a2.8 2.8 0 1 1 5.6 0`} {...line("#ff7b8a", 1.4)} />
      ));
    case "shizuku":
      return bothCheeks((x) => <path d={dropPath(x, 68, 2.6)} fill="#8ec6de" opacity="0.9" />);
    case "ase":
      return <path d={dropPath(80, 48, 3)} fill="#8ec6de" stroke="#6fb0cf" strokeWidth="0.8" />;
    case "star":
      return bothCheeks((x) => <path d={starPath(x, 68, 3.4)} fill="#ffd34d" />);
    case "bandage":
      return (
        <g className="mp-fixed" transform="rotate(-20 71 68)">
          <rect x="64" y="65.2" width="14" height="5.6" rx="2.8" fill="#f5d1a8" stroke="#ddb084" strokeWidth="0.9" />
          <rect x="69" y="65.6" width="4" height="4.8" fill="#fae6cf" />
          <g fill="#ddb084">
            <circle cx="66" cy="67" r="0.5" />
            <circle cx="66" cy="69" r="0.5" />
            <circle cx="76" cy="67" r="0.5" />
            <circle cx="76" cy="69" r="0.5" />
          </g>
        </g>
      );
    case "nekohige":
      return (
        <g {...line(ink, 1.2)}>
          <path d="M19 64 l11 2 M18 68 h12 M19 72 l11 -2" />
          <path d="M81 64 l-11 2 M82 68 h-12 M81 72 l-11 -2" />
        </g>
      );
    case "happa":
      return bothCheeks((x, m) => <ellipse className="mp-fixed" cx={x} cy={68} rx="3.6" ry="2" fill="#7cbf6a" transform={`rotate(${-30 * m} ${x} 68)`} />);
    case "oko":
      return (
        <g className="mp-fixed" {...line("#e45b5b", 2)} transform="translate(76 44)">
          <path d="M-5 -1.5 q3.5 0 3.5 -3.5 M1.5 -5 q0 3.5 3.5 3.5 M5 1.5 q-3.5 0 -3.5 3.5 M-1.5 5 q0 -3.5 -3.5 -3.5" />
        </g>
      );
    case "heart":
      return bothCheeks((x) => <path d={heartPath(x, 68, 3)} fill="#ff7c96" opacity="0.85" />);
    case "kirakira":
      return bothCheeks((x) => (
        <g fill="#ffd34d">
          <path d={sparklePath(x - 1.5, 67, 3)} />
          <path d={sparklePath(x + 3, 70, 1.6)} />
        </g>
      ));
    case "sakura":
      return bothCheeks((x) => (
        <g className="mp-fixed" transform={`translate(${x} 68)`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse className="mp-fixed" key={a} cx="0" cy="-2.2" rx="1.5" ry="2.3" fill="#ffb7c9" transform={`rotate(${a})`} />
          ))}
          <circle r="0.9" fill="#ff8fab" />
        </g>
      ));
    case "yuki":
      return bothCheeks((x) => (
        <g className="mp-fixed" {...line("#9fd6f5", 1.2)} transform={`translate(${x} 68)`}>
          <path d="M0 -3.5 V3.5 M-3 -1.75 L3 1.75 M-3 1.75 L3 -1.75" />
        </g>
      ));
    case "onpu":
      return bothCheeks((x) => (
        <text x={x} y={71} fontSize="8" textAnchor="middle" fill={ink}>
          ♪
        </text>
      ));
    case "ichigo":
      return bothCheeks((x) => (
        <g className="mp-fixed" transform={`translate(${x} 68)`}>
          <path d="M-3 -1.5 Q0 -2.6 3 -1.5 Q2.8 2.2 0 4 Q-2.8 2.2 -3 -1.5Z" fill="#ff6b7a" />
          <path d="M-2 -2.2 L0 -3.6 L2 -2.2" fill="#6aa35c" />
          <g fill="#ffe27a">
            <circle cx="-1" cy="0" r="0.35" />
            <circle cx="1" cy="0.4" r="0.35" />
            <circle cx="0" cy="2" r="0.35" />
          </g>
        </g>
      ));
    case "sticker":
      return (
        <g>
          <path d={starPath(71, 68, 5.2)} fill="#fff" />
          <path d={starPath(71, 68, 4)} fill="#ffd34d" />
          <path d={sparklePath(69.5, 66.5, 1.2)} fill="#fff" />
        </g>
      );
    case "niji":
      return bothCheeks((x) => (
        <g fill="none" strokeWidth="1.3" strokeLinecap="round">
          <path d={`M${x - 4.5} ${70} a4.5 4.5 0 0 1 9 0`} stroke="#ff9aa2" />
          <path d={`M${x - 3.2} ${70} a3.2 3.2 0 0 1 6.4 0`} stroke="#ffd27f" />
          <path d={`M${x - 1.9} ${70} a1.9 1.9 0 0 1 3.8 0`} stroke="#8ec6f5" />
        </g>
      ));
    default:
      return null;
  }
}
