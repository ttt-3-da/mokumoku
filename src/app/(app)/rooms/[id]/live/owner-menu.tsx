"use client";

import { useCallback, useEffect, useState } from "react";
import { Mochi } from "@/components/mochi";
import { Button } from "@/components/ui";
import { parseAvatar, type Avatar } from "@/lib/avatar";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { FREE_THEMES, ROOM_THEMES, type RoomTheme } from "@/lib/room-theme";
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
  onEvacuate,
  onDeleteRoom,
}: {
  room: Room;
  isOwner: boolean;
  theme: RoomTheme;
  onChangeTheme: (t: RoomTheme) => Promise<string | null>;
  timerRunning: boolean;
  onStartTimer: () => Promise<string | null>;
  onEvacuate: () => Promise<string | null>;
  onDeleteRoom: () => Promise<string | null>;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-cream p-3 text-sm">
      <InviteLink code={room.invite_code} />
      {room.timer_mode === "pomodoro" && <TimerControl running={timerRunning} onStart={onStartTimer} />}
      {room.visibility === "approval" && <PendingRequests roomId={room.id} />}
      <ScheduleEditor room={room} />
      <ThemePicker roomId={room.id} theme={theme} onChange={onChangeTheme} />
      <Bans roomId={room.id} />
      <DangerZone isOwner={isOwner} onEvacuate={onEvacuate} onDeleteRoom={onDeleteRoom} />
      <p className="text-xs text-ink-soft">キック・BAN・モデレーターの任命は、在室者のもちを選ぶと出てきます。</p>
    </div>
  );
}

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** 定例の部屋：曜日と開始時刻。ポモドーロの部屋なら開始時刻にタイマーが自動で始まる */
function ScheduleEditor({ room }: { room: Room }) {
  const [days, setDays] = useState<number[]>(room.schedule_days ?? []);
  const [time, setTime] = useState(room.schedule_time?.slice(0, 5) ?? "07:00");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const { error } = await createClient().rpc("set_room_schedule", { p_room_id: room.id, p_days: days, p_time: days.length ? time : null });
    setSaving(false);
    setMessage(error ? { ok: false, text: rpcErrorMessage(error) } : { ok: true, text: days.length ? "定例を保存しました" : "定例をやめました" });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-bold">定例（日本時間）</legend>
      <div className="flex flex-wrap items-center gap-1">
        {DAY_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={days.includes(i + 1)}
            onClick={() => toggle(i + 1)}
            className={`h-8 w-8 rounded-full text-xs ${days.includes(i + 1) ? "bg-ink font-bold text-paper" : "bg-paper hover:bg-sakura/20"}`}
          >
            {label}
          </button>
        ))}
        <input
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setMessage(null);
          }}
          aria-label="開始時刻"
          className="ml-1 rounded-xl border border-line bg-paper px-2 py-1 text-xs"
        />
        <Button variant="secondary" onClick={save} disabled={saving || (days.length > 0 && !time)} className="ml-auto !px-3 !py-1">
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
      <p className="text-xs text-ink-soft">
        参加したことのある人とオーナーをフォローしている人のロビーに30分前から出ます。参加したことのある人には 📬 でもお知らせします。
        {room.timer_mode === "pomodoro" && "開始時刻にポモドーロが自動で始まります。"}
        曜日を全部外して保存すると、定例をやめます。
      </p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </fieldset>
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

type ThemeShop = { tomatoes: number; owned: string[]; items: { theme: string; price: number }[] };

/**
 * 部屋のテーマ（オーナー・モデレーター）。図書館とカフェは無料、ほかは部屋にたまった🍅で買う。
 * 🍅は、その部屋でのみんなの勉強時間25分で1個たまる
 */
function ThemePicker({
  roomId,
  theme,
  onChange,
}: {
  roomId: string;
  theme: RoomTheme;
  onChange: (t: RoomTheme) => Promise<string | null>;
}) {
  const [shop, setShop] = useState<ThemeShop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("room_theme_shop", { p_room_id: roomId });
    if (data) setShop(data as ThemeShop);
  }, [roomId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    // 勉強中の分も🍅に入るので、開いている間はときどき読み直す
    const id = setInterval(() => void load(), 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [load]);

  const priceOf = (id: string) => shop?.items.find((i) => i.theme === id)?.price;
  const available = (id: string) => FREE_THEMES.includes(id as RoomTheme) || (shop?.owned.includes(id) ?? false);

  async function buy(id: RoomTheme, price: number) {
    if (!window.confirm(`「${ROOM_THEMES[id].label}」を、部屋の🍅${price}で買いますか？（返品はできません）`)) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("buy_room_theme", { p_room_id: roomId, p_theme: id });
    if (error) setError(rpcErrorMessage(error));
    await load();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2 font-bold">
        部屋のテーマ
        {shop && <span className="text-xs font-normal text-ink-soft">この部屋の🍅 {shop.tomatoes}（みんなの勉強25分で1個）</span>}
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="部屋のテーマ">
        {(Object.entries(ROOM_THEMES) as [RoomTheme, (typeof ROOM_THEMES)[RoomTheme]][]).map(([id, t]) => {
          const price = priceOf(id);
          if (available(id)) {
            return (
              <button
                key={id}
                type="button"
                aria-pressed={theme === id}
                disabled={busy}
                onClick={async () => setError(await onChange(id))}
                className={`rounded-full px-3 py-1 text-xs ${theme === id ? "bg-ink text-paper" : "bg-paper hover:bg-sakura/20"}`}
              >
                {t.icon} {t.label}
              </button>
            );
          }
          const short = price !== undefined && shop !== null && shop.tomatoes < price;
          return (
            <button
              key={id}
              type="button"
              disabled={busy || price === undefined || short}
              onClick={() => price !== undefined && buy(id, price)}
              title={short ? `あと🍅${price! - shop!.tomatoes}で買えます` : undefined}
              className="rounded-full border border-dashed border-line bg-paper px-3 py-1 text-xs text-ink-soft hover:bg-sakura/10 disabled:opacity-50"
            >
              {t.icon} {t.label} 🍅{price ?? "…"}
            </button>
          );
        })}
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
/** 一斉退出（オーナー・モデレーター）と部屋の削除（オーナーのみ） */
function DangerZone({
  isOwner,
  onEvacuate,
  onDeleteRoom,
}: {
  isOwner: boolean;
  onEvacuate: () => Promise<string | null>;
  onDeleteRoom: () => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<string | null>, confirmText: string, okText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    const error = await fn();
    setBusy(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: okText });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-paper p-3">
      <span className="font-bold text-red-700">部屋の管理</span>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1 text-xs"
          disabled={busy}
          onClick={() =>
            run(onEvacuate, "あなた以外の全員を、この部屋から退室させますか？（記録はそれぞれに残ります）", "全員を退室させました")
          }
        >
          一斉退出
        </Button>
        {isOwner && (
          <Button
            variant="danger"
            className="px-3 py-1 text-xs"
            disabled={busy}
            onClick={() =>
              run(
                onDeleteRoom,
                "この部屋を削除しますか？全員が退室し、一覧や招待URLからも消えます。元に戻せません。（みんなの記録には「削除された部屋」として残ります）",
                "部屋を削除しました",
              )
            }
          >
            部屋を削除
          </Button>
        )}
      </div>
      <span className="text-xs text-ink-soft">
        一斉退出は、あなた以外の全員を退室させます。{isOwner && "部屋の削除は、全員を退室させて部屋をなくします。"}
      </span>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}