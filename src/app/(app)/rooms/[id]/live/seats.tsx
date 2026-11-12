"use client";

import { DeskItem, Mochi } from "@/components/mochi";
import { heatLevel, type Avatar } from "@/lib/avatar";
import { getEmote, type EmoteId } from "@/lib/emotes";
import { STATUS_LABEL } from "@/lib/presence";
import { formatClock } from "@/lib/pomodoro";
import { toRows } from "@/lib/room-logic";
import type { PresenceStatus } from "@/lib/types";

export type SeatMember = {
  userId: string;
  displayName: string;
  task: string;
  status: PresenceStatus;
  avatar: Avatar;
  /** 連続集中の分数 */
  focusMinutes: number;
  /** 自由モードのストップウォッチの時間（使っていなければ null） */
  stopwatchMs: number | null;
  stopwatchRunning: boolean;
  plantLevel: 1 | 2 | 3;
  role: "owner" | "moderator" | null;
  leaving?: boolean;
};

type Props = {
  members: SeatMember[];
  meId: string;
  selectedId: string | null;
  onSelect: (userId: string) => void;
  celebrate: boolean;
  /** userId → 受け取ったスタンプの時刻（跳ねる演出を毎回やり直すための key） */
  hops: Record<string, number>;
  looks: Record<string, "left" | "right">;
  /** userId → いま出しているエモート */
  emotes: Record<string, { emote: EmoteId; key: string }>;
  canSelect: boolean;
};

/** 机が横並び。人数が増えたら2列目 */
export function Seats({ members, meId, selectedId, onSelect, celebrate, hops, looks, emotes, canSelect }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {toRows(members).map((row, i) => (
        <ul key={i} className="grid grid-cols-5 items-end gap-x-1 sm:gap-x-3">
          {row.map((m) => (
            <Seat
              key={m.userId}
              member={m}
              isMe={m.userId === meId}
              selected={m.userId === selectedId}
              onSelect={canSelect && m.userId !== meId && !m.leaving ? () => onSelect(m.userId) : undefined}
              celebrate={celebrate && m.status !== "away" && !m.leaving}
              hop={hops[m.userId]}
              look={looks[m.userId] ?? null}
              emote={m.leaving ? undefined : emotes[m.userId]}
            />
          ))}
        </ul>
      ))}
    </div>
  );
}

function Seat({
  member,
  isMe,
  selected,
  onSelect,
  celebrate,
  hop,
  look,
  emote,
}: {
  member: SeatMember;
  isMe: boolean;
  selected: boolean;
  onSelect?: () => void;
  celebrate: boolean;
  hop: number | undefined;
  look: "left" | "right" | null;
  emote: { emote: EmoteId; key: string } | undefined;
}) {
  const emoteInfo = emote ? getEmote(emote.emote) : undefined;
  const label = `${member.displayName}（${STATUS_LABEL[member.status]}）：${member.task}`;
  const body = (
    <>
      {emoteInfo ? (
        // エモート中は「今やること」の代わりに吹き出しを出す
        <div key={emote!.key} className="animate-mochi-drop max-w-full truncate rounded-xl bg-sakura/30 px-2 py-1 text-[11px] font-bold leading-tight shadow-sm" role="status">
          {emoteInfo.icon} {emoteInfo.label}
        </div>
      ) : (
        <div
          className="max-w-full truncate rounded-xl bg-paper px-2 py-1 text-[11px] leading-tight shadow-sm"
          title={member.task}
        >
          {member.task}
        </div>
      )}
      <div className="animate-mochi-drop" data-seat-user={member.userId}>
        <Mochi
          // スタンプを受け取るたびに作り直して、跳ねる演出を最初から再生する
          key={`${hop ?? 0}-${emote?.key ?? ""}`}
          avatar={member.avatar}
          size={64}
          state={member.status}
          seed={member.userId}
          heat={member.status === "focus" ? heatLevel(member.focusMinutes) : 0}
          celebrate={celebrate}
          hop={hop !== undefined}
          look={look}
          leaving={member.leaving}
          emote={emote?.emote ?? null}
        />
      </div>
      {/* 机 */}
      <div className="relative -mt-3 h-4 w-full max-w-24 rounded-md bg-[var(--desk,#d9b98c)] shadow-[0_3px_0_var(--desk-edge,#c4a274)]" aria-hidden>
        <span className="absolute -top-6 right-0">
          <DeskItem kind={member.avatar.desk} size={24} level={member.plantLevel} />
        </span>
      </div>
      <span className="mt-1 max-w-full truncate rounded-md bg-paper/85 px-1.5 text-xs font-bold">
        {member.role === "owner" && <span aria-label="オーナー">👑</span>}
        {member.role === "moderator" && <span aria-label="モデレーター">🛡️</span>}
        {member.displayName}
        {isMe && <span className="ml-0.5 text-accent-strong">（あなた）</span>}
      </span>
      <span className="rounded-md bg-paper/70 px-1.5 text-[11px] text-ink-soft">{member.leaving ? "またね" : STATUS_LABEL[member.status]}</span>
      {member.stopwatchMs !== null && !member.leaving && (
        <span
          className={`rounded-full px-2 text-[11px] tabular-nums ${member.stopwatchRunning ? "bg-yomogi/25 text-green-800" : "bg-cream text-ink-soft"}`}
          aria-label={`ストップウォッチ ${formatClock(member.stopwatchMs)}${member.stopwatchRunning ? "（計測中）" : "（停止中）"}`}
        >
          {member.stopwatchRunning ? "⏱️" : "⏸️"} {formatClock(member.stopwatchMs)}
        </span>
      )}
    </>
  );

  return (
    <li className="flex min-w-0 flex-col items-center gap-1 text-center [content-visibility:auto]">
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`${label}。スタンプを送る相手に選ぶ`}
          className={`flex w-full flex-col items-center gap-1 rounded-2xl p-1 transition ${
            selected ? "bg-sakura/25 ring-2 ring-accent" : "hover:bg-paper/60"
          }`}
        >
          {body}
        </button>
      ) : (
        <div className="flex w-full flex-col items-center gap-1 p-1" aria-label={label}>
          {body}
        </div>
      )}
    </li>
  );
}
