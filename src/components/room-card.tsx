import Link from "next/link";
import { Tag } from "@/components/ui";
import { TimerBadge } from "@/components/timer-badge";
import type { RoomCard as RoomCardData } from "@/lib/types";

const VISIBILITY_LABEL = { public: null, unlisted: "🔗 限定", approval: "🔒 承認制" } as const;

export function RoomCard({ room }: { room: RoomCardData }) {
  const full = room.active_count >= room.capacity;
  const visibility = VISIBILITY_LABEL[room.visibility];

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="group flex flex-col gap-3 rounded-3xl border border-line bg-paper p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream text-2xl" aria-hidden>
          {room.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold group-hover:text-accent-strong">{room.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {room.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <TimerBadge
          timer_mode={room.timer_mode}
          timer_started_at={room.timer_started_at}
          focus_minutes={room.focus_minutes}
          break_minutes={room.break_minutes}
        />
        {visibility && <span className="text-ink-soft">{visibility}</span>}
        {!room.is_persistent && <span className="text-ink-soft">⏳ 一時</span>}
        <span className={`ml-auto font-bold tabular-nums ${full ? "text-red-600" : ""}`}>
          👤 {room.active_count}/{room.capacity}
          {full && <span className="ml-1">満員</span>}
        </span>
      </div>
    </Link>
  );
}
