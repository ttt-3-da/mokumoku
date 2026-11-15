import type { FurnitureId } from "@/lib/mochi-room";

const INK = "#3f3a36";

/** もちの部屋の家具の絵（横幅いっぱいに描く。縦横比は家具ごと） */
export function FurnitureArt({ id, className = "" }: { id: FurnitureId; className?: string }) {
  const p = { className, "aria-hidden": true as const, overflow: "visible" as const };
  switch (id) {
    case "plant":
      return (
        <svg viewBox="0 0 40 60" {...p}>
          <path d="M20 34 C8 30 4 18 10 10 C14 20 18 24 20 34Z M20 34 C32 30 36 18 30 8 C26 18 22 24 20 34Z M20 36 C14 22 18 8 20 2 C22 8 26 22 20 36Z" fill="#7fb069" stroke="#4f7d3a" strokeWidth={1.5} />
          <path d="M10 36 h20 l-3 22 h-14Z" fill="#d98b5f" stroke="#a86440" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      );
    case "rug":
      return (
        <svg viewBox="0 0 100 24" {...p}>
          <ellipse cx="50" cy="12" rx="48" ry="11" fill="#f4c7a1" stroke="#d9a07a" strokeWidth={1.5} />
          <ellipse cx="50" cy="12" rx="34" ry="7" fill="none" stroke="#fff4e8" strokeWidth={2.5} strokeDasharray="4 4" />
        </svg>
      );
    case "lamp":
      return (
        <svg viewBox="0 0 30 80" {...p}>
          <path d="M5 22 L10 4 H20 L25 22Z" fill="#fff1b8" stroke="#e0c25a" strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M15 22 V74" stroke="#8d6446" strokeWidth={2.5} />
          <ellipse cx="15" cy="76" rx="9" ry="3" fill="#8d6446" />
        </svg>
      );
    case "cushion":
      return (
        <svg viewBox="0 0 44 30" {...p}>
          <path d="M4 8 Q22 0 40 8 Q46 15 40 22 Q22 30 4 22 Q-2 15 4 8Z" fill="#cdb7e6" stroke="#9d86bd" strokeWidth={1.5} />
          <circle cx="22" cy="15" r="2" fill="#9d86bd" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 30 30" {...p}>
          <circle cx="15" cy="15" r="13" fill="#fffaf3" stroke="#8d6446" strokeWidth={3} />
          <path d="M15 15 V7 M15 15 L21 18" stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </svg>
      );
    case "window":
      return (
        <svg viewBox="0 0 60 50" {...p}>
          <rect x="2" y="2" width="56" height="44" rx="4" fill="#cfe8ff" stroke="#fffaf3" strokeWidth={4} />
          <path d="M30 2 V46 M2 24 H58" stroke="#fffaf3" strokeWidth={3} />
          <circle cx="44" cy="13" r="5" fill="#ffd34d" />
          <rect x="0" y="44" width="60" height="5" rx="2" fill="#c9a574" />
        </svg>
      );
    case "shelf":
      return (
        <svg viewBox="0 0 50 70" {...p}>
          <rect x="2" y="2" width="46" height="66" rx="3" fill="#b08b5c" stroke="#8d6446" strokeWidth={1.5} />
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect x="6" y={6 + row * 21} width="38" height="17" fill="#8d6446" />
              {["#e98aa1", "#8fb98b", "#8ec6de", "#e6c88f", "#cdb7e6", "#f4a6b8"].map((c, i) => (
                <rect key={i} x={8 + i * 6} y={9 + row * 21 + ((i + row) % 3)} width="4.5" height={14 - ((i + row) % 3)} rx="1" fill={c} />
              ))}
            </g>
          ))}
        </svg>
      );
    case "sofa":
      return (
        <svg viewBox="0 0 100 50" {...p}>
          <rect x="10" y="4" width="80" height="26" rx="10" fill="#8ec6de" stroke="#5a9fc0" strokeWidth={1.5} />
          <rect x="4" y="22" width="92" height="20" rx="8" fill="#a8d6e8" stroke="#5a9fc0" strokeWidth={1.5} />
          <rect x="0" y="16" width="14" height="28" rx="7" fill="#8ec6de" stroke="#5a9fc0" strokeWidth={1.5} />
          <rect x="86" y="16" width="14" height="28" rx="7" fill="#8ec6de" stroke="#5a9fc0" strokeWidth={1.5} />
          <path d="M14 44 v5 M86 44 v5" stroke="#8d6446" strokeWidth={3} />
        </svg>
      );
    case "bed":
      return (
        <svg viewBox="0 0 100 50" {...p}>
          <rect x="2" y="4" width="10" height="44" rx="3" fill="#b08b5c" />
          <rect x="8" y="22" width="90" height="20" rx="5" fill="#fffaf3" stroke="#c9bfb3" strokeWidth={1.5} />
          <rect x="40" y="18" width="58" height="24" rx="6" fill="#f4a6b8" stroke="#d98197" strokeWidth={1.5} />
          <ellipse cx="24" cy="22" rx="11" ry="6" fill="#ffffff" stroke="#c9bfb3" strokeWidth={1.5} />
          <path d="M10 42 v6 M94 42 v6" stroke="#8d6446" strokeWidth={3} />
        </svg>
      );
    case "kotatsu":
      return (
        <svg viewBox="0 0 100 50" {...p}>
          <path d="M6 18 Q50 10 94 18 L98 44 Q50 50 2 44Z" fill="#e45b5b" stroke="#b83d3d" strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M10 26 Q50 20 90 26" fill="none" stroke="#ffd34d" strokeWidth={2} strokeDasharray="5 4" />
          <rect x="8" y="10" width="84" height="8" rx="2" fill="#c9a574" stroke="#8d6446" strokeWidth={1.5} />
          <circle cx="66" cy="8" r="4" fill="#ffa53d" />
          <circle cx="74" cy="8" r="4" fill="#ffa53d" />
        </svg>
      );
  }
}
