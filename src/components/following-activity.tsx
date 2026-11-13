import Link from "next/link";
import { Mochi } from "@/components/mochi";
import type { FollowingActivity as Activity } from "@/lib/follow";

/** いま勉強中のフォロー中の人。公開部屋ならその部屋へ行ける。限定・承認制の部屋なら「勉強中」とだけ出す */
export function FollowingActivity({ items }: { items: Activity[] }) {
  return (
    <ul className="flex gap-3 overflow-x-auto pb-2">
      {items.map((a) => {
        const body = (
          <>
            <Mochi avatar={a.avatar} size={56} state="focus" seed={a.username} />
            <span className="w-full truncate text-xs font-bold">{a.display_name}</span>
            <span className="w-full truncate text-[11px] text-ink-soft">
              {a.room_id ? `${a.room_icon} ${a.room_name}` : "🔒 勉強中"}
            </span>
          </>
        );
        return (
          <li key={a.username} className="w-28 shrink-0">
            {a.room_id ? (
              <Link
                href={`/rooms/${a.room_id}`}
                title={a.task ? `今やること：${a.task}` : undefined}
                className="flex flex-col items-center gap-1 rounded-3xl border border-line bg-paper p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {body}
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-3xl border border-line bg-paper p-3 text-center shadow-sm">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
