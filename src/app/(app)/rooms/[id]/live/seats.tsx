"use client";

import type { ReactNode } from "react";
import { DeskItem, Mochi } from "@/components/mochi";
import { heatLevel, type Avatar } from "@/lib/avatar";
import { EmoteGlyph } from "@/components/emote-marks";
import { getEmote, type EmoteId } from "@/lib/emotes";
import { STATUS_LABEL } from "@/lib/presence";
import { formatClock } from "@/lib/pomodoro";
import { toRows } from "@/lib/room-logic";
import type { DeskStyle } from "@/lib/room-theme";
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
  /** テーマの机の形 */
  deskStyle?: DeskStyle;
};

/** 机が横並び。人数が増えたら2列目 */
export function Seats({ members, meId, selectedId, onSelect, celebrate, hops, looks, emotes, canSelect, deskStyle = "desk" }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {toRows(members).map((row, i) => (
        <ul key={i} className="grid grid-cols-5 items-end gap-x-1 sm:gap-x-3">
          {row.map((m) => (
            <Seat
              deskStyle={deskStyle}
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
  deskStyle,
  member,
  isMe,
  selected,
  onSelect,
  celebrate,
  hop,
  look,
  emote,
}: {
  deskStyle: DeskStyle;
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
          <EmoteGlyph emote={emoteInfo.id} size={12} className="mr-0.5 inline-block align-[-1px]" />
          {emoteInfo.label}
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
      {/* 机（形はテーマによって変わる。机の小物はどの形でも右上に乗る） */}
      <Desk style={deskStyle}>
        <span className="absolute -top-6 right-0">
          <DeskItem kind={member.avatar.desk} size={24} level={member.plantLevel} />
        </span>
      </Desk>
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
    <li className="flex min-w-0 flex-col items-center gap-1 text-center [content-visibility:auto] [contain-intrinsic-size:auto_150px]">
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

/** テーマごとの机の形。どれも同じ幅に収め、上に机の小物が乗るようにする */
function Desk({ style, children }: { style: DeskStyle; children: ReactNode }) {
  const base = "relative -mt-3 w-full max-w-24";
  switch (style) {
    case "school":
      return (
        <div className={`${base} h-3.5 rounded-sm bg-[#d9b98c] shadow-[0_2px_0_#b8956a]`} aria-hidden>
          <span className="absolute left-2 top-full h-3 w-1 bg-[#8a8f99]" />
          <span className="absolute right-2 top-full h-3 w-1 bg-[#8a8f99]" />
          {children}
        </div>
      );
    case "kotatsu":
      return (
        <div className={`${base} h-3 rounded-sm bg-[var(--desk)] shadow-[0_2px_0_var(--desk-edge)]`} aria-hidden>
          <span className="absolute -inset-x-1 top-full h-3 rounded-b-md bg-[repeating-linear-gradient(90deg,#e45b5b_0_6px,#f08a6b_6px_12px)] opacity-90" />
          {children}
        </div>
      );
    case "stump":
      return (
        <div className={`${base} flex h-5 justify-center`} aria-hidden>
          <span className="h-5 w-16 rounded-[50%] border-2 border-[#8d6446] bg-[#d9a87e] shadow-[0_3px_0_#6e4e34]">
            <span className="mx-auto mt-1 block h-2 w-8 rounded-[50%] border border-[#b08b5c]" />
          </span>
          {children}
        </div>
      );
    case "seat":
      return (
        <div className={`${base} h-4 rounded-lg bg-[var(--desk)] shadow-[0_3px_0_var(--desk-edge)]`} aria-hidden>
          <span className="absolute inset-x-1 top-1 h-0.5 rounded bg-white/30" />
          {children}
        </div>
      );
    case "cloud":
      return (
        <div className={`${base} flex h-5 justify-center`} aria-hidden>
          <span className="h-5 w-20 rounded-full bg-white shadow-[0_3px_6px_rgba(120,150,190,0.35)]" />
          <span className="absolute -top-1.5 left-1/2 h-5 w-10 -translate-x-1/2 rounded-full bg-white" />
          {children}
        </div>
      );
    case "bench":
      return (
        <div className={`${base} h-4 rounded-sm bg-[repeating-linear-gradient(90deg,var(--desk)_0_10px,var(--desk-edge)_10px_12px)] shadow-[0_3px_0_var(--desk-edge)]`} aria-hidden>
          {children}
        </div>
      );
    case "low":
      return (
        <div className={`${base} h-2.5 rounded-sm bg-[var(--desk)] shadow-[0_2px_0_var(--desk-edge)]`} aria-hidden>
          <span className="absolute left-2 top-full h-1.5 w-1.5 bg-[var(--desk-edge)]" />
          <span className="absolute right-2 top-full h-1.5 w-1.5 bg-[var(--desk-edge)]" />
          {children}
        </div>
      );
    case "counter":
      return (
        <div className={`${base} h-4 rounded-sm bg-[var(--desk)] shadow-[0_3px_0_var(--desk-edge)]`} aria-hidden>
          <span className="absolute inset-x-0 top-full h-2 bg-[repeating-linear-gradient(90deg,#fff_0_6px,#e45b5b_6px_12px)]" />
          {children}
        </div>
      );
    case "desk":
    default:
      return (
        <div className={`${base} h-4 rounded-md bg-[var(--desk,#d9b98c)] shadow-[0_3px_0_var(--desk-edge,#c4a274)]`} aria-hidden>
          {children}
        </div>
      );
  }
}
