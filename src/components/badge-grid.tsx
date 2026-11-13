import { BADGE_IDS, BADGES, type BadgeId } from "@/lib/badges";

const fmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });

/** バッジを並べる。まだ取っていないものはシルエット */
export function BadgeGrid({ earned }: { earned: Map<BadgeId, string> }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
      {BADGE_IDS.map((id) => {
        const b = BADGES[id];
        const at = earned.get(id);
        return (
          <li
            key={id}
            title={`${b.name}：${b.desc}`}
            className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-center ${at ? "bg-sakura/15" : "bg-cream"}`}
          >
            <span className={`text-2xl ${at ? "" : "opacity-40 grayscale brightness-0 dark-silhouette"}`} aria-hidden>
              {b.icon}
            </span>
            <span className={`text-[11px] font-bold leading-tight ${at ? "" : "text-ink-soft"}`}>{at ? b.name : "？？？"}</span>
            <span className="text-[10px] leading-tight text-ink-soft">{at ? fmt.format(new Date(at)) : b.desc}</span>
            <span className="sr-only">{at ? "取得済み" : "まだ取っていない"}</span>
          </li>
        );
      })}
    </ul>
  );
}
