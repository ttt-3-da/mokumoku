"use client";

import { DeleteRoom } from "@/components/delete-room";
import { RoomInfoEditor } from "@/components/room-info-editor";
import { InviteLink } from "@/components/invite-link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  onClose,
}: {
  onClose: () => void;
  room: Room;
  isOwner: boolean;
  theme: RoomTheme;
  onChangeTheme: (t: RoomTheme) => Promise<string | null>;
  timerRunning: boolean;
  onStartTimer: () => Promise<string | null>;
  onEvacuate: () => Promise<string | null>;
  onDeleteRoom: () => Promise<string | null>;
}) {
  const [tab, setTab] = useState<SettingsTab>("basic");

  // Esc で閉じる。開いている間は後ろの画面をスクロールさせない
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      {/* スマホは下から出るシート、広い画面は右から出る欄 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="部屋の設定"
        className="sheet-in absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-cream shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-full bg-paper px-3 py-1 text-sm font-bold shadow-sm hover:bg-sakura/20">
            ← 部屋に戻る
          </button>
          <h2 className="ml-auto font-bold">部屋の設定</h2>
        </div>
        <div className="flex gap-1 px-4 pt-3" role="tablist" aria-label="設定の種類">
          {(Object.keys(SETTINGS_TABS) as SettingsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-sm ${tab === t ? "bg-ink font-bold text-paper" : "bg-paper hover:bg-sakura/20"}`}
            >
              {SETTINGS_TABS[t]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-4 text-sm">
          {tab === "basic" && (
            <>
              {isOwner && <RoomInfoEditor room={room} />}
              <div className="flex flex-col gap-1">
                <span className="font-bold">招待リンク</span>
                <InviteLink code={room.invite_code} roomName={room.name} />
              </div>
              {room.timer_mode === "pomodoro" && <TimerControl running={timerRunning} onStart={onStartTimer} />}
              <ScheduleEditor room={room} />
              <Evacuate onEvacuate={onEvacuate} />
              {isOwner && <DeleteRoom roomName={room.name} onDeleteRoom={onDeleteRoom} />}
            </>
          )}
          {tab === "members" && (
            <>
              {room.visibility === "approval" && <PendingRequests roomId={room.id} />}
              <Bans roomId={room.id} />
              <p className="text-xs text-ink-soft">キック・BAN・モデレーターの任命は、在室者のもちを選ぶと出てきます。</p>
            </>
          )}
          {tab === "look" && <ThemePicker roomId={room.id} theme={theme} onChange={onChangeTheme} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const SETTINGS_TABS = { basic: "基本", members: "メンバー", look: "見た目" } as const;
type SettingsTab = keyof typeof SETTINGS_TABS;

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
/** 一斉退出（オーナー・モデレーター） */
function Evacuate({ onEvacuate }: { onEvacuate: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    if (!window.confirm("あなた以外の全員を、この部屋から退室させますか？（記録はそれぞれに残ります）")) return;
    setBusy(true);
    const error = await onEvacuate();
    setBusy(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: "全員を退室させました" });
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="font-bold">一斉退出</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" className="px-3 py-1 text-xs" disabled={busy} onClick={run}>
          全員を退室させる
        </Button>
        <span className="text-xs text-ink-soft">あなた以外の全員を退室させます。部屋は残ります。</span>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
