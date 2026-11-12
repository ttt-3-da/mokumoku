"use client";

import { useCallback, useEffect, useState } from "react";
import { Mochi } from "@/components/mochi";
import { Button } from "@/components/ui";
import { parseAvatar, type Avatar } from "@/lib/avatar";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { ROOM_THEMES, type RoomTheme } from "@/lib/room-theme";
import type { Room } from "@/lib/types";

type Pending = { user_id: string; username: string; display_name: string; requested_at: string; avatar: Avatar };

/**
 * オーナー・モデレーター用の設定メニュー：招待URL、タイマー開始、入室申請の承認。
 * テーマの変更（オーナーのみ）、BAN の解除。キック・BAN は在室者のもちを選んで行う。
 */
export function OwnerMenu({
  room,
  isOwner,
  theme,
  onChangeTheme,
  timerRunning,
  onStartTimer,
}: {
  room: Room;
  isOwner: boolean;
  theme: RoomTheme;
  onChangeTheme: (t: RoomTheme) => Promise<string | null>;
  timerRunning: boolean;
  onStartTimer: () => Promise<string | null>;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-cream p-3 text-sm">
      <InviteLink code={room.invite_code} />
      {room.timer_mode === "pomodoro" && <TimerControl running={timerRunning} onStart={onStartTimer} />}
      {room.visibility === "approval" && <PendingRequests roomId={room.id} />}
      {isOwner && <ThemePicker theme={theme} onChange={onChangeTheme} />}
      <Bans roomId={room.id} />
      <p className="text-xs text-ink-soft">キック・BAN・モデレーターの任命は、在室者のもちを選ぶと出てきます。</p>
    </div>
  );
}

function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/r/${code}` : `${window.location.origin}/r/${code}`;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-bold">招待URL</span>
      <div className="flex gap-2">
        <input readOnly value={url} aria-label="招待URL" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // クリップボードが使えない環境では入力欄を選択してコピーしてもらう
            }
          }}
        >
          {copied ? "コピーしました" : "コピー"}
        </Button>
      </div>
      <span className="text-xs text-ink-soft">このURLを開いた人は、入室前の画面に直接来られます。</span>
    </div>
  );
}

function TimerControl({ running, onStart }: { running: boolean; onStart: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <span className="font-bold">ポモドーロタイマー</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            if (running && !window.confirm("タイマーを最初からやり直しますか？（それまでのポモドーロ回数は記録に残ります）")) return;
            setBusy(true);
            setError(await onStart());
            setBusy(false);
          }}
        >
          {busy ? "開始中…" : running ? "最初からやり直す" : "タイマーを開始"}
        </Button>
        <span className="text-xs text-ink-soft">部屋の全員のタイマーが同時に始まります。</span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function PendingRequests({ roomId }: { roomId: string }) {
  const [items, setItems] = useState<Pending[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("list_pending_members", { p_room_id: roomId });
    if (error) return setError(rpcErrorMessage(error));
    setError(null);
    setItems(((data ?? []) as Pending[]).map((p) => ({ ...p, avatar: parseAvatar(p.avatar) })));
  }, [roomId]);

  useEffect(() => {
    // メニューを開いている間は20秒ごとに更新する（申請者は部屋のチャンネルに入れないため）
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function decide(userId: string, approve: boolean) {
    const { error } = await createClient().rpc(approve ? "approve_member" : "reject_member", {
      p_room_id: roomId,
      p_user_id: userId,
    });
    if (error) setError(rpcErrorMessage(error));
    await load();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-bold">入室の申請 {items && items.length > 0 && <span className="text-accent-strong">（{items.length}件）</span>}</span>
      {items === null ? (
        <span className="text-xs text-ink-soft">読み込み中…</span>
      ) : items.length === 0 ? (
        <span className="text-xs text-ink-soft">申請はありません。</span>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((p) => (
            <li key={p.user_id} className="flex items-center gap-2 rounded-xl bg-paper p-2">
              <Mochi avatar={p.avatar} size={36} seed={p.user_id} />
              <span className="min-w-0 flex-1 truncate">
                <b>{p.display_name}</b> <span className="text-xs text-ink-soft">@{p.username}</span>
              </span>
              <Button className="shrink-0 px-3 py-1 text-xs" onClick={() => decide(p.user_id, true)}>
                承認
              </Button>
              <Button variant="ghost" className="shrink-0 px-3 py-1 text-xs" onClick={() => decide(p.user_id, false)}>
                見送る
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function ThemePicker({ theme, onChange }: { theme: RoomTheme; onChange: (t: RoomTheme) => Promise<string | null> }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <span className="font-bold">部屋のテーマ</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="部屋のテーマ">
        {(Object.entries(ROOM_THEMES) as [RoomTheme, (typeof ROOM_THEMES)[RoomTheme]][]).map(([id, t]) => (
          <button
            key={id}
            type="button"
            aria-pressed={theme === id}
            onClick={async () => setError(await onChange(id))}
            className={`rounded-full px-3 py-1 text-xs ${theme === id ? "bg-ink text-paper" : "bg-paper hover:bg-sakura/20"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

type Ban = { user_id: string; username: string; display_name: string; banned_at: string };

function Bans({ roomId }: { roomId: string }) {
  const [items, setItems] = useState<Ban[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await createClient().rpc("list_room_bans", { p_room_id: roomId });
    setItems((data ?? []) as Ban[]);
  }, [roomId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="font-bold">BAN した人（{items.length}人）</span>
      <ul className="flex flex-col gap-1">
        {items.map((b) => (
          <li key={b.user_id} className="flex items-center gap-2 rounded-xl bg-paper px-2 py-1">
            <span className="min-w-0 flex-1 truncate">
              {b.display_name} <span className="text-xs text-ink-soft">@{b.username}</span>
            </span>
            <Button
              variant="ghost"
              className="shrink-0 px-3 py-1 text-xs"
              onClick={async () => {
                await createClient().rpc("unban_member", { p_room_id: roomId, p_user_id: b.user_id });
                await load();
              }}
            >
              BAN を解除
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}