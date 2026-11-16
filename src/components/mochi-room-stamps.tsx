"use client";

import Link from "next/link";
import { useState } from "react";
import { StampArt } from "@/components/stamp-art";
import type { Avatar } from "@/lib/avatar";
import { getStamp, type Stamp, type StampId } from "@/lib/stamps";

/** もちの部屋に、遊びに来た人が置いていったスタンプ */
export type RoomStamp = {
  id: string;
  stamp_id: StampId;
  x: number;
  y: number;
  created_at: string;
  mine: boolean;
  sender_username: string;
  sender_display_name: string;
  sender_avatar: Avatar;
};

/** 部屋の中に並べる。部屋の人と置いた人は、押すと「×」で消せる */
export function PlacedStamps({ stamps, canRemoveAll, onRemove }: { stamps: RoomStamp[]; canRemoveAll: boolean; onRemove: (s: RoomStamp) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      {stamps.map((s) => {
        const removable = canRemoveAll || s.mine;
        const label = `${s.sender_display_name} さんの「${getStamp(s.stamp_id)?.label ?? ""}」`;
        return (
          <div
            key={s.id}
            className="absolute z-10 flex flex-col items-center"
            style={{ left: `${s.x}%`, top: `${s.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <button
              type="button"
              onClick={() => setSelected((v) => (v === s.id ? null : s.id))}
              className="rounded-full bg-paper/70 p-0.5 shadow-sm transition hover:scale-110"
              aria-label={label}
              title={label}
            >
              <StampArt id={s.stamp_id} avatar={s.sender_avatar} size={40} />
            </button>
            {selected === s.id && (
              <div className="mt-1 flex items-center gap-1 whitespace-nowrap rounded-full bg-paper px-2 py-0.5 text-[11px] shadow">
                <Link href={`/u/${s.sender_username}`} className="font-bold hover:underline">
                  {s.sender_display_name}
                </Link>
                {removable && (
                  <button type="button" onClick={() => onRemove(s)} className="ml-1 rounded-full px-1 text-red-600 hover:bg-red-50" aria-label={`${label}を消す`}>
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** 遊びに来た人がスタンプを選んで置く */
export function StampPalette({ stamps, avatar, disabled, onPick }: { stamps: Stamp[]; avatar: Avatar; disabled: boolean; onPick: (id: StampId) => void }) {
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {stamps.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          disabled={disabled}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream transition hover:scale-110 hover:bg-sakura/20 disabled:opacity-40 disabled:hover:scale-100"
          aria-label={`${s.label} スタンプを置く`}
          title={s.label}
        >
          <StampArt id={s.id} avatar={avatar} size={34} />
        </button>
      ))}
      <Link
        href="/shop?kind=stamp"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-lg text-ink-soft hover:bg-cream"
        aria-label="ショップでスタンプをふやす"
        title="ショップでスタンプをふやす"
      >
        ＋
      </Link>
    </div>
  );
}
