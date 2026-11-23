/**
 * ショップで買えるアクセサリー（3回目）。
 * - 頭の小物15種・首の小物5種：もちの SVG（viewBox 0 0 100 100、体は中心 (50,62)・横34・縦28 の楕円）に描く
 * - 机の小物10種：机の上に置く小さな SVG（viewBox 0 0 40 40、下端 y=37 あたりが机の面）
 */
import type { ReactNode } from "react";
import { heartPath, starPath } from "./mochi-parts";

const STROKE = 2.6;

// ---------------------------------------------------------------- 頭

export const EXTRA_HEADS = new Set([
  "ahoge", "odango", "bigribbon", "nekomimi", "usamimi", "kumamimi", "chonmage", "beret",
  "knit", "tsuno", "mugiwara", "hanakanmuri", "headphones", "mahou", "tenshi", "silkhat",
]);

/** 体の上の縁（頭のてっぺん付近）の y 座標 */
function topY(x: number): number {
  const dx = (x - 50) / 34;
  return 62 - 28 * Math.sqrt(Math.max(0, 1 - dx * dx));
}

export function ExtraHead({
  kind,
  ink,
  fill,
  edge,
}: {
  kind: string;
  ink: string;
  /** 体の色（耳など、体と同じ色で描くもの用） */
  fill: string;
  edge: string;
}): ReactNode {
  switch (kind) {
    case "ahoge":
      return <path d="M51 35 q-3 -9 3 -12 q6 -2 3 5" fill="none" stroke={ink} strokeWidth={STROKE} strokeLinecap="round" />;
    case "odango":
      return (
        <g>
          <circle cx="50" cy="27" r="8" fill="#8b6248" />
          <path d="M45 23 q3 -3 7 -1" fill="none" stroke="#a87b5a" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="43" y="33" width="14" height="3" rx="1.5" fill="#ff8fab" />
        </g>
      );
    case "bigribbon":
      return (
        <g className="mp-fixed" transform="translate(50 32)">
          <ellipse cx="-11" cy="0" rx="11" ry="7" fill="#ff6f91" transform="rotate(-15 -11 0)" />
          <ellipse cx="11" cy="0" rx="11" ry="7" fill="#ff6f91" transform="rotate(15 11 0)" />
          <path d="M-3 3 L-8 14 M3 3 L8 14" stroke="#ff6f91" strokeWidth="3" strokeLinecap="round" />
          <circle r="4" fill="#ff4f7a" />
        </g>
      );
    case "nekomimi":
      return (
        <g>
          {[
            [30, 1],
            [70, -1],
          ].map(([x, m]) => (
            <g key={x}>
              <path d={`M${x - 9 * m} ${topY(x) + 6} L${x - 2 * m} ${topY(x) - 12} L${x + 9 * m} ${topY(x) + 2} Z`} fill={fill} stroke={edge} strokeWidth={STROKE} strokeLinejoin="round" />
              <path d={`M${x - 5 * m} ${topY(x) + 3} L${x - 2 * m} ${topY(x) - 6} L${x + 4 * m} ${topY(x) + 1} Z`} fill="#ffb3c1" />
            </g>
          ))}
        </g>
      );
    case "usamimi":
      return (
        <g className="mp-fixed">
          {[
            [41, -10],
            [59, 10],
          ].map(([x, a]) => (
            <g key={x} transform={`rotate(${a} ${x} 36)`}>
              <ellipse cx={x} cy="20" rx="6" ry="15" fill={fill} stroke={edge} strokeWidth={STROKE} />
              <ellipse cx={x} cy="21" rx="2.8" ry="10" fill="#ffb3c1" />
            </g>
          ))}
        </g>
      );
    case "kumamimi":
      return (
        <g>
          {[29, 71].map((x) => (
            <g key={x}>
              <circle cx={x} cy={topY(x) - 1} r="8" fill={fill} stroke={edge} strokeWidth={STROKE} />
              <circle cx={x} cy={topY(x) - 1} r="4" fill="#d9a87e" />
            </g>
          ))}
        </g>
      );
    case "chonmage":
      return (
        <g fill="#3f3a36">
          <rect x="47" y="24" width="6" height="12" rx="2" />
          <ellipse cx="50" cy="24" rx="9" ry="3.5" />
        </g>
      );
    case "beret":
      return (
        <g>
          <ellipse cx="54" cy="35" rx="23" ry="8" fill="#d9534f" />
          <path d="M33 37 q21 6 42 0" fill="none" stroke="#b8403c" strokeWidth="2" />
          <rect x="56" y="24" width="3" height="5" rx="1.5" fill="#b8403c" />
        </g>
      );
    case "knit":
      return (
        <g>
          <path d="M22 46 Q24 14 50 14 Q76 14 78 46 Z" fill="#8ec6de" />
          <path d="M34 44 V22 M42 44 V16 M50 44 V14 M58 44 V16 M66 44 V22" stroke="#7cb5d0" strokeWidth="1.4" />
          <rect x="20" y="40" width="60" height="8" rx="4" fill="#6fb0cf" />
          <circle cx="50" cy="12" r="6" fill="#fff" stroke="#e1edf2" strokeWidth="1.4" />
        </g>
      );
    case "tsuno":
      return (
        <g>
          {[
            [39, -1],
            [61, 1],
          ].map(([x, m]) => (
            <path key={x} d={`M${x - 5} ${topY(x) + 2} Q${x + 2 * m} ${topY(x) - 6} ${x + 3 * m} ${topY(x) - 13} Q${x + 6 * m} ${topY(x) - 4} ${x + 5} ${topY(x) + 2} Z`} fill="#ffd34d" stroke="#e6b62e" strokeWidth="1.4" strokeLinejoin="round" />
          ))}
        </g>
      );
    case "mugiwara":
      return (
        <g>
          <ellipse cx="50" cy="37" rx="34" ry="8" fill="#f2d07a" stroke="#d9b45a" strokeWidth="1.6" />
          <path d="M31 37 Q32 17 50 17 Q68 17 69 37 Z" fill="#f2d07a" stroke="#d9b45a" strokeWidth="1.6" />
          <path d="M32 32 Q50 36 68 32 L68.6 36 Q50 40 31.4 36 Z" fill="#e45b5b" />
        </g>
      );
    case "hanakanmuri":
      return (
        <g>
          {[30, 40, 50, 60, 70].map((x, i) => (
            <g key={x} className="mp-fixed" transform={`translate(${x} ${topY(x) - 1})`}>
              <ellipse cx="-4" cy="2" rx="3" ry="1.6" fill="#7cbf6a" transform="rotate(-30)" />
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy="-2.6" rx="2" ry="2.8" fill={["#ffb7c9", "#fff3a3", "#ffffff", "#c9b2e6", "#ffb7c9"][i]} transform={`rotate(${a})`} />
              ))}
              <circle r="1.6" fill="#ffd34d" />
            </g>
          ))}
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M17 58 Q16 16 50 16 Q84 16 83 58" fill="none" stroke="#5a6199" strokeWidth="4" strokeLinecap="round" />
          <rect x="11" y="50" width="10" height="17" rx="4" fill="#5a6199" />
          <rect x="79" y="50" width="10" height="17" rx="4" fill="#5a6199" />
          <rect x="13" y="54" width="3" height="9" rx="1.5" fill="#8d96c4" />
          <rect x="84" y="54" width="3" height="9" rx="1.5" fill="#8d96c4" />
        </g>
      );
    case "mahou":
      return (
        <g>
          <path d="M34 38 Q46 24 54 4 Q58 24 66 38 Z" fill="#6b4fa0" />
          <ellipse cx="50" cy="38" rx="26" ry="5.5" fill="#5a4190" />
          <path d="M37 34 Q50 37 63 34 L64 37.5 Q50 40.5 36 37.5 Z" fill="#ffd34d" />
          <path d={starPath(55, 22, 3.6)} fill="#ffd34d" />
        </g>
      );
    case "silkhat":
      // 紳士のハット：赤いシルクハットに黒いリボン
      return (
        <g>
          <ellipse cx="50" cy="37" rx="25" ry="5.5" fill="#b8282e" stroke="#8f1d22" strokeWidth="1.4" />
          <path d="M36 36 L37.5 12 Q50 9.5 62.5 12 L64 36 Q50 39 36 36 Z" fill="#d33a3f" stroke="#8f1d22" strokeWidth="1.4" strokeLinejoin="round" />
          <ellipse cx="50" cy="12" rx="12.5" ry="2.6" fill="#e2585c" stroke="#8f1d22" strokeWidth="1.2" />
          <path d="M36.6 29 Q50 31.6 63.4 29 L63.8 34.6 Q50 37.4 36.2 34.6 Z" fill="#2b2326" />
          <path d="M41 14 L40 27" stroke="#f08a8d" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case "tenshi":
      return (
        <g className="mochi-halo">
          <ellipse cx="50" cy="20" rx="17" ry="4.8" fill="none" stroke="#fff3a3" strokeWidth="6" opacity="0.6" />
          <ellipse cx="50" cy="20" rx="17" ry="4.8" fill="none" stroke="#ffd34d" strokeWidth="3" />
        </g>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------- 首

export function NeckItem({ kind, uid }: { kind: string; uid: string }): ReactNode {
  switch (kind) {
    case "yodare":
      return (
        <g>
          <path d="M37 75 Q50 72 63 75 Q64 89 50 90 Q36 89 37 75 Z" fill="#fff" stroke="#e8d9c6" strokeWidth="1.6" />
          <path d={heartPath(50, 82, 2.6)} fill="#ff9fb3" />
        </g>
      );
    case "choutie":
      return (
        <g>
          <path d="M50 79 L40 73 L40 85 Z" fill="#d9534f" />
          <path d="M50 79 L60 73 L60 85 Z" fill="#d9534f" />
          <rect x="47" y="76" width="6" height="6" rx="1.5" fill="#b8403c" />
        </g>
      );
    case "muffler":
      return (
        <g>
          <g clipPath={`url(#body-${uid})`}>
            <rect x="10" y="73" width="80" height="9" fill="#e45b5b" />
            <path d="M14 77.5 h72" stroke="#fff" strokeWidth="1.6" strokeDasharray="4 4" opacity="0.7" />
          </g>
          <rect x="62" y="78" width="8" height="15" rx="2" fill="#e45b5b" />
          <path d="M62 93 v2 M64.6 93 v2 M67.2 93 v2 M69.8 93 v2" stroke="#e45b5b" strokeWidth="1.2" />
        </g>
      );
    case "scarf":
      return (
        <g>
          <g clipPath={`url(#body-${uid})`}>
            <rect x="10" y="75" width="80" height="6" fill="#8ec6de" />
          </g>
          <path d="M33 77 L26 88 L35 84 Z" fill="#8ec6de" />
          <circle cx="33" cy="78" r="2.6" fill="#6fb0cf" />
        </g>
      );
    case "pendant":
      return (
        <g>
          <path d="M33 71 Q50 85 67 71" fill="none" stroke="#c9962a" strokeWidth="1.2" />
          <path d="M50 78.5 L54 82.5 L50 87.5 L46 82.5 Z" fill="#8ec6de" stroke="#c9962a" strokeWidth="1" />
          <path d="M48 81.5 l2 -1.5" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------- 机

export const EXTRA_DESKS = new Set(["pencils", "onigiri", "books", "sunadokei", "mezamashi", "saboten", "cake", "globe", "kingyo", "nekonui"]);

export function ExtraDesk({ kind }: { kind: string }): ReactNode {
  switch (kind) {
    case "pencils":
      return (
        <g>
          <rect x="14" y="11" width="3" height="16" rx="1" fill="#ffd34d" transform="rotate(-10 15 19)" />
          <rect x="19" y="8" width="3" height="18" rx="1" fill="#5b8def" />
          <rect x="24" y="11" width="3" height="16" rx="1" fill="#e45b5b" transform="rotate(10 25 19)" />
          <rect x="12" y="21" width="17" height="16" rx="3" fill="#8ec6de" />
        </g>
      );
    case "onigiri":
      return (
        <g>
          <path d="M20 12 Q24 12 32 30 Q33 36 20 36 Q7 36 8 30 Q16 12 20 12 Z" fill="#fffdf7" stroke="#e6d9c6" strokeWidth="1.4" />
          <rect x="14" y="27" width="12" height="9" rx="1.5" fill="#2f3b2f" />
        </g>
      );
    case "books":
      return (
        <g>
          <rect x="7" y="29" width="26" height="7" rx="1.5" fill="#5b8def" />
          <rect x="9" y="22" width="22" height="7" rx="1.5" fill="#e98aa1" />
          <rect x="6" y="15" width="25" height="7" rx="1.5" fill="#8fb98b" />
          <path d="M10 18.5 h17 M12 25.5 h15 M11 32.5 h18" stroke="#fff" strokeWidth="1" opacity="0.6" />
        </g>
      );
    case "sunadokei":
      return (
        <g>
          <rect x="11" y="7" width="18" height="3" rx="1.5" fill="#a87b5a" />
          <rect x="11" y="34" width="18" height="3" rx="1.5" fill="#a87b5a" />
          <path d="M13 10 h14 L20 22 Z M13 34 h14 L20 22 Z" fill="#e8f4fa" stroke="#bcd6e3" strokeWidth="1" />
          <path d="M16 13 h8 L20 19 Z" fill="#f2d07a" />
          <path d="M14.5 34 Q20 27 25.5 34 Z" fill="#f2d07a" />
        </g>
      );
    case "mezamashi":
      return (
        <g>
          <circle cx="13" cy="13" r="4" fill="#ffd34d" />
          <circle cx="27" cy="13" r="4" fill="#ffd34d" />
          <circle cx="20" cy="23" r="11" fill="#e45b5b" />
          <circle cx="20" cy="23" r="8" fill="#fff" />
          <path d="M20 23 V18 M20 23 L24 25" stroke="#3f3a36" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M13 33 l-2 4 M27 33 l2 4" stroke="#b8403c" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "saboten":
      return (
        <g>
          <rect x="17" y="10" width="7" height="20" rx="3.5" fill="#7cbf6a" />
          <path d="M17 21 h-4 q-2 0 -2 -2 v-4" fill="none" stroke="#7cbf6a" strokeWidth="4" strokeLinecap="round" />
          <path d="M24 18 h4 q2 0 2 -2 v-3" fill="none" stroke="#7cbf6a" strokeWidth="4" strokeLinecap="round" />
          <circle cx="20.5" cy="9" r="2" fill="#ff9fb3" />
          <path d="M12 27 h17 l-2 10 h-13 z" fill="#d9a066" />
        </g>
      );
    case "cake":
      return (
        <g>
          <path d="M7 24 L33 24 L33 36 L7 36 Z" fill="#fff6e6" stroke="#ead8bd" strokeWidth="1.2" />
          <path d="M7 29 h26" stroke="#ffb3c1" strokeWidth="2" />
          <path d="M7 24 Q20 18 33 24" fill="#fffdf7" stroke="#ead8bd" strokeWidth="1.2" />
          <path d="M20 13 Q24 14 23 19 Q21 22 20 22 Q19 22 17 19 Q16 14 20 13 Z" fill="#ff6b7a" />
          <path d="M18 13.5 L20 11.5 L22 13.5" fill="#6aa35c" />
        </g>
      );
    case "globe":
      return (
        <g>
          <path d="M8 21 A12 12 0 0 0 28 31" fill="none" stroke="#a89b8c" strokeWidth="2" />
          <circle cx="20" cy="20" r="10" fill="#8ec6f0" />
          <path d="M14 15 q4 -2 6 1 q-1 4 -5 3 z M21 21 q4 0 5 3 q-3 3 -6 1 z" fill="#8fb98b" />
          <rect x="18.5" y="31" width="3" height="4" fill="#a89b8c" />
          <ellipse cx="20" cy="36" rx="7" ry="2" fill="#a89b8c" />
        </g>
      );
    case "kingyo":
      return (
        <g>
          <path d="M8 16 Q4 37 20 37 Q36 37 32 16 Z" fill="#cfeaf7" fillOpacity="0.85" stroke="#9fcde3" strokeWidth="1.4" />
          <ellipse cx="20" cy="16" rx="12" ry="2.5" fill="none" stroke="#9fcde3" strokeWidth="1.4" />
          <g className="desk-fish">
            <ellipse cx="19" cy="27" rx="4.5" ry="3" fill="#ff7a45" />
            <path d="M23 27 l4 -3 v6 z" fill="#ff7a45" />
            <circle cx="16.5" cy="26.4" r="0.8" fill="#3f3a36" />
          </g>
          <path d="M11 33 q2 -4 1 -8 M28 33 q-1 -3 0 -6" stroke="#7cbf6a" strokeWidth="1.4" fill="none" />
        </g>
      );
    case "nekonui":
      return (
        <g>
          <ellipse cx="20" cy="30" rx="10" ry="7" fill="#f2d7a0" stroke="#d8b06c" strokeWidth="1.2" />
          <circle cx="20" cy="18" r="8" fill="#f2d7a0" stroke="#d8b06c" strokeWidth="1.2" />
          <path d="M13 14 L14 6 L19 11 Z M27 14 L26 6 L21 11 Z" fill="#f2d7a0" stroke="#d8b06c" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="17" cy="18" r="1" fill="#3f3a36" />
          <circle cx="23" cy="18" r="1" fill="#3f3a36" />
          <path d="M18.5 21 q1.5 1.2 3 0" fill="none" stroke="#3f3a36" strokeWidth="0.9" strokeLinecap="round" />
          <path d="M29 31 q6 -2 4 -8" fill="none" stroke="#d8b06c" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}
