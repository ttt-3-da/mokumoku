"use client";

import { TodoList } from "@/components/todo-list";
import type { Todo } from "@/lib/todo";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, inputClass } from "@/components/ui";
import { parseAvatar, type Avatar } from "@/lib/avatar";
import { rpcErrorMessage } from "@/lib/errors";
import { useDocumentHidden } from "@/lib/hooks/use-document-hidden";
import { useNow } from "@/lib/hooks/use-now";
import { computeTimer, formatClock, nextPhaseChange, type TimerState } from "@/lib/pomodoro";
import { resolveStatus } from "@/lib/presence";
import {
  claimStampSlot,
  continuousFocusMinutes,
  isCelebrating,
  neighborCompanions,
  stampsAllowed,
  STAMP_INTERVAL_MS,
  type StampEvent,
} from "@/lib/room-logic";
import {
  clockNow,
  parseStopwatch,
  startStopwatch,
  stopStopwatch,
  stopwatchElapsed,
  STOPWATCH_ZERO,
  type Stopwatch,
} from "@/lib/stopwatch";
import { parseTheme, ROOM_THEMES, type RoomTheme } from "@/lib/room-theme";
import { playSound, unlockAudio, useMuted } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import {
  canUseEmote,
  claimEmoteSlot,
  EMOTES,
  EMOTE_DURATION_MS,
  EMOTE_INTERVAL_MS,
  emoteGroups,
  type EmoteEvent,
  type EmoteId,
} from "@/lib/emotes";
import { type PresenceMeta, type Room, type StudySession } from "@/lib/types";
import Link from "next/link";
import { EmoteGlyph } from "@/components/emote-marks";
import { StampArt } from "@/components/stamp-art";
import { usableStamps, type StampId } from "@/lib/stamps";
import { TASK_MAX, validateTask } from "@/lib/validation";
import { IdleDialog, useIdleCheck } from "./idle-check";
import { MemberActions, type RoomRole } from "./member-actions";
import { CopyInviteButton } from "@/components/invite-link";
import { OwnerMenu } from "./owner-menu";
import { RoomScene } from "./room-scene";
import { Seats, type SeatMember } from "./seats";
import { useRoomChannel } from "./use-room-channel";
import { sameAccount, useHeartbeat, useServerOffset } from "./use-room-sync";

type Props = {
  room: Room;
  session: StudySession;
  me: { id: string; displayName: string; avatar: Avatar; plantLevel: 1 | 2 | 3 };
  /** 買った品物（スタンプ・エモートを使えるか） */
  owned: string[];
  isStaff: boolean;
  /** ブロックしている・されている人。おたがいのもちとスタンプを出さない */
  blocked: string[];
  /** ToDo（まだのものと、ここ2日に終わったもの） */
  todos: Todo[];
};

type Flight = { id: string; stamp: StampId; from: string; x: number; y: number; dx: number; dy: number; peak: number };

const FLIGHT_MS = 900;
const HOP_MS = 1300;
const LEAVE_MS = 1500;

export function RoomLive({ room, session, me, isStaff, owned, blocked, todos }: Props) {
  const blockedSet = useMemo(() => new Set(blocked), [blocked]);
  const ownedSet = useMemo(() => new Set(owned), [owned]);
  const myStamps = useMemo(() => usableStamps(owned), [owned]);
  const router = useRouter();
  const hidden = useDocumentHidden();
  const offset = useServerOffset();
  const now = useNow(1000, offset);
  const [task, setTask] = useState(session.task);
  const [timerStartedAt, setTimerStartedAt] = useState(room.timer_started_at);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountSwitched, setAccountSwitched] = useState(false);
  const [theme, setTheme] = useState<RoomTheme>(parseTheme(room.theme));

  // ---------------------------------------------------------------- 役割（オーナー・モデレーター）とキック・BAN
  const [roles, setRoles] = useState<Record<string, RoomRole> | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const myRole: RoomRole | null = roles ? (roles[me.id] ?? null) : isStaff ? (room.owner_id === me.id ? "owner" : "moderator") : null;
  const staffNow = myRole !== null;

  async function loadRoles() {
    const supabase = createClient();
    const [{ data: roleRows }, { data: roomRow }] = await Promise.all([
      supabase.rpc("list_room_roles", { p_room_id: room.id }),
      supabase.from("rooms").select("theme").eq("id", room.id).maybeSingle(),
    ]);
    if (roleRows) {
      setRoles(Object.fromEntries((roleRows as { user_id: string; role: RoomRole }[]).map((r) => [r.user_id, r.role])));
    }
    if (roomRow) setTheme(parseTheme(roomRow.theme));
  }

  // ---------------------------------------------------------------- 自由モードのストップウォッチ
  // リロードしても続きから使えるよう、セッションごとに localStorage に保存する
  const swKey = `mokumoku:stopwatch:${session.id}`;
  const [stopwatch, setStopwatch] = useState<Stopwatch | null>(null);
  useEffect(() => {
    if (room.timer_mode !== "free") return;
    const id = setTimeout(() => {
      let saved: Stopwatch | null = null;
      try {
        saved = parseStopwatch(JSON.parse(localStorage.getItem(swKey) ?? "null"));
      } catch {
        // 保存できない環境では毎回0から
      }
      setStopwatch(saved ?? STOPWATCH_ZERO);
    }, 0);
    return () => clearTimeout(id);
  }, [room.timer_mode, swKey]);

  function updateStopwatch(next: Stopwatch) {
    setStopwatch(next);
    try {
      localStorage.setItem(swKey, JSON.stringify(next));
    } catch {
      // 保存できなくても動作は続ける
    }
  }

  const timer: TimerState =
    room.timer_mode === "pomodoro" && now !== null
      ? computeTimer(timerStartedAt, room.focus_minutes, room.break_minutes, now)
      : { kind: "idle" };
  // タブが見えないまま15分たったら「離席中」（それまでは、ほかのタブで調べものをしていても集中中のまま）
  const [awaySelf, setAwaySelf] = useState(false);
  useEffect(() => {
    if (!hidden) {
      const t = setTimeout(() => setAwaySelf(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setAwaySelf(true), AWAY_AFTER_MS);
    return () => clearTimeout(t);
  }, [hidden]);
  const status = awaySelf ? "away" : resolveStatus({ timerPhase: timer.kind });

  // 記録が区切られた・入り直したときのお知らせ（画面を作り直したあとに出す）
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const msg = sessionStorage.getItem(NOTICE_KEY);
        if (msg) {
          sessionStorage.removeItem(NOTICE_KEY);
          setNotice(msg);
        }
      } catch {
        // 読めなくても困らない
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  function reopenWithNotice(msg: string) {
    try {
      sessionStorage.setItem(NOTICE_KEY, msg);
    } catch {
      // 出せなくても困らない
    }
    router.refresh();
  }

  // ---------------------------------------------------------------- 効果音
  const [muted, toggleMuted] = useMuted();
  const [audioOn, setAudioOn] = useState(false);
  useEffect(() => unlockAudio(() => setAudioOn(true)), []);

  // 休憩の始まり・終わりの音は、次の切り替わり時刻に予約しておく（見ていないタブでも時間どおりに鳴る）
  useEffect(() => {
    if (muted || !audioOn || room.timer_mode !== "pomodoro") return;
    const change = nextPhaseChange(timerStartedAt, room.focus_minutes, room.break_minutes, clockNow(offset));
    if (!change) return;
    return playSound(change.next === "break" ? "breakStart" : "breakEnd", change.inMs / 1000);
    // timer.kind が変わる（＝切り替わった）たびに、次の切り替わりを予約し直す
  }, [muted, audioOn, room.timer_mode, timerStartedAt, room.focus_minutes, room.break_minutes, offset, timer.kind]);

  // ---------------------------------------------------------------- スタンプ
  const seatsRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hops, setHops] = useState<Record<string, number>>({});
  const [cooling, setCooling] = useState(false);
  const lastSentRef = useRef<number | null>(null);

  function playStamp(ev: StampEvent) {
    if (blockedSet.has(ev.from) || blockedSet.has(ev.to)) return;
    const box = seatsRef.current;
    const from = box?.querySelector<HTMLElement>(`[data-seat-user="${ev.from}"]`);
    const to = box?.querySelector<HTMLElement>(`[data-seat-user="${ev.to}"]`);
    // 自分あて・自分が送ったスタンプは、相手に届く瞬間に音を鳴らす
    if ((ev.to === me.id || ev.from === me.id) && !muted) playSound("stamp", FLIGHT_MS / 1000);
    if (!box || !to) return;
    const b = box.getBoundingClientRect();
    const t = to.getBoundingClientRect();
    const f = (from ?? to).getBoundingClientRect();
    const x = f.left + f.width / 2 - b.left;
    const y = f.top + f.height / 3 - b.top;
    const dx = t.left + t.width / 2 - b.left - x;
    const dy = t.top + t.height / 3 - b.top - y;
    const peak = Math.min(0, dy) - 70;
    setFlights((list) => [...list, { id: ev.id, stamp: ev.stamp, from: ev.from, x, y, dx, dy, peak }]);
    setTimeout(() => {
      setFlights((list) => list.filter((fl) => fl.id !== ev.id));
      setHops((h) => ({ ...h, [ev.to]: Date.now() }));
      setTimeout(
        () =>
          setHops((h) => {
            const next = { ...h };
            delete next[ev.to];
            return next;
          }),
        HOP_MS,
      );
    }, FLIGHT_MS);
  }

  // ---------------------------------------------------------------- エモート
  const [emotes, setEmotes] = useState<Record<string, { emote: EmoteId; key: string }>>({});
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [emoteCooling, setEmoteCooling] = useState(false);
  const lastEmoteRef = useRef<number | null>(null);

  function playEmote(ev: EmoteEvent) {
    if (blockedSet.has(ev.from)) return;
    // 自分のエモートも、ほかの人のエモートも鳴らす
    if (!muted) playSound("emote");
    setEmotes((m) => ({ ...m, [ev.from]: { emote: ev.emote, key: ev.id } }));
    setTimeout(
      () =>
        setEmotes((m) => {
          if (m[ev.from]?.key !== ev.id) return m; // 次のエモートに上書きされていたら消さない
          const next = { ...m };
          delete next[ev.from];
          return next;
        }),
      EMOTE_DURATION_MS,
    );
  }

  async function emote(id: EmoteId) {
    if (!claimEmoteSlot(lastEmoteRef)) return;
    setEmoteCooling(true);
    setTimeout(() => setEmoteCooling(false), EMOTE_INTERVAL_MS);
    const ev: EmoteEvent = { id: crypto.randomUUID(), from: me.id, emote: id };
    playEmote(ev);
    await sendEmote(ev);
  }

  // ---------------------------------------------------------------- 公式マーク（DB から読む。Presence の値は偽れるので使わない）
  const [officialIds, setOfficialIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    void createClient()
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .then(({ data }) => {
        if (alive && data) setOfficialIds(new Set(data.map((r) => r.id as string)));
      });
    return () => {
      alive = false;
    };
  }, []);

  // ---------------------------------------------------------------- 退室した人を少し残す（手を振って消える）
  const [departed, setDeparted] = useState<PresenceMeta[]>([]);
  const prevMembersRef = useRef<PresenceMeta[]>([]);
  const departTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const { members: presenceMembers, connection, untrack, sendStamp, sendEmote, sendTimer, sendModeration } = useRoomChannel({
    roomId: room.id,
    self: {
      userId: me.id,
      displayName: me.displayName,
      task,
      status,
      joinedAt: session.started_at,
      avatar: me.avatar,
      // 0のまま一度も動かしていなければ共有しない
      stopwatch: stopwatch && (stopwatch.accMs > 0 || stopwatch.since !== null) ? stopwatch : null,
      plantLevel: me.plantLevel,
    },
    handlers: {
      onStamp: playStamp,
      onEmote: playEmote,
      onTimer: (startedAt) => setTimerStartedAt(startedAt),
      onSubscribed: async () => {
        // 接続が切れている間にタイマーが始まっていたかもしれないので取り直す
        const { data } = await createClient().from("rooms").select("timer_started_at").eq("id", room.id).maybeSingle();
        if (data) setTimerStartedAt(data.timer_started_at as string | null);
        void loadRoles();
      },
      onModeration: ({ userId, action }) => {
        if (action === "role") {
          void loadRoles();
          return;
        }
        if (action === "evacuate" || action === "deleted") {
          // 一斉退出・部屋の削除：操作した本人以外は退室扱い（セッションはサーバー側で閉じられている）
          if (userId === me.id) return;
          // サーバー側で退室の処理が終わるのを少し待ってから移動する
          setTimeout(() => {
            void untrack();
            router.replace(`/sessions/${session.id}/done?removed=${action}`);
          }, 1500);
          return;
        }
        if (userId === me.id) {
          // 自分がキック・BAN された（セッションはサーバー側で閉じられている）
          void untrack();
          router.replace(`/sessions/${session.id}/done?removed=${action}`);
          return;
        }
        setRemoved((s) => new Set(s).add(userId));
      },
    },
  });
  // タブが見えていない人：画面が止まって Presence から消えても部屋にはいるので、サーバーから取って並べる。
  // 見えなくなって15分をこえた人は「離席中」
  const [hiddenMembers, setHiddenMembers] = useState<HiddenMember[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await createClient().rpc("get_room_hidden_members", { p_room_id: room.id });
      if (!cancelled) setHiddenMembers((data ?? []) as HiddenMember[]);
    };
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [room.id]);
  const nowMinute = now === null ? null : Math.floor(now / 60_000);
  const withHidden = mergeHiddenMembers(presenceMembers, hiddenMembers, me.id, nowMinute === null ? null : nowMinute * 60_000, resolveStatus({ timerPhase: timer.kind }));
  // キック・BAN された人は、その人の画面が閉じるのを待たずに消す
  const members = withHidden.filter((m) => !removed.has(m.userId) && !blockedSet.has(m.userId));
  const memberIds = members.map((m) => m.userId).join(",");
  // その人の画面が閉じて Presence から消えたら、隠すリストからも外す（キックのあと入り直せるように）
  useEffect(() => {
    const stale = [...removed].filter((id) => !presenceMembers.some((m) => m.userId === id));
    if (stale.length === 0) return;
    const t = setTimeout(
      () =>
        setRemoved((s) => {
          const next = new Set(s);
          stale.forEach((id) => next.delete(id));
          return next;
        }),
      0,
    );
    return () => clearTimeout(t);
  }, [presenceMembers, removed]);

  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  });
  useEffect(() => {
    const members = membersRef.current;
    const prev = prevMembersRef.current;
    prevMembersRef.current = members;
    const gone = prev.filter((p) => !members.some((m) => m.userId === p.userId));
    if (gone.length === 0) return;
    // Presence の更新が続けて来ても消し忘れないよう、タイマーは次の更新では止めない（画面を閉じるときだけ止める）
    const timers = departTimersRef.current;
    const add = setTimeout(() => setDeparted((d) => [...d.filter((x) => !gone.some((g) => g.userId === x.userId)), ...gone]), 0);
    const remove = setTimeout(() => {
      setDeparted((d) => d.filter((x) => !gone.some((g) => g.userId === x.userId)));
      timers.delete(add);
      timers.delete(remove);
    }, LEAVE_MS);
    timers.add(add);
    timers.add(remove);
  }, [memberIds]);

  useEffect(() => {
    const timers = departTimersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // ---------------------------------------------------------------- 仲良し（累計10時間以上一緒）
  const memberKey = members.map((m) => m.userId).join(",");
  const [companions, setCompanions] = useState<[string, string][]>([]);
  const [looks, setLooks] = useState<Record<string, "left" | "right">>({});

  useEffect(() => {
    if (!memberKey.includes(",")) return; // 1人なら不要
    let cancelled = false;
    const id = setTimeout(async () => {
      const { data } = await createClient().rpc("get_room_companions", { p_room_id: room.id });
      if (!cancelled) setCompanions(((data ?? []) as { user_a: string; user_b: string }[]).map((r) => [r.user_a, r.user_b]));
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [memberKey, room.id]);

  const neighborPairs = useMemo(
    () => neighborCompanions(memberKey ? memberKey.split(",") : [], companions),
    [memberKey, companions],
  );

  useEffect(() => {
    if (neighborPairs.length === 0) return;
    // ときどき（15秒に1回くらい、半分の確率で）隣の仲良しと顔を見合わせる
    const id = setInterval(() => {
      if (Math.random() < 0.5) return;
      const [a, b] = neighborPairs[Math.floor(Math.random() * neighborPairs.length)];
      setLooks({ [a]: "right", [b]: "left" });
      setTimeout(() => setLooks({}), 2500);
    }, 15_000);
    return () => clearInterval(id);
  }, [neighborPairs]);

  // ---------------------------------------------------------------- ハートビート
  const idle = useIdleCheck();
  useHeartbeat({
    getIdleSeconds: idle.getIdleSeconds,
    userId: me.id,
    task,
    enabled: !accountSwitched,
    onBeat: (r) => {
      if (r.timer_started_at !== timerStartedAt) setTimerStartedAt(r.timer_started_at);
    },
    onLost: () => {
      // しばらく通信できなかった間に、自動で退室扱いになった。同じ部屋に入り直せたら、そのまま続ける
      void (async () => {
        const { data, error } = await createClient().rpc("rejoin_after_drop", { p_session_id: session.id });
        if (!error && (data as { status?: string } | null)?.status === "entered") {
          reopenWithNotice("しばらく画面から離れていたので、入り直しました。勉強の記録は、離れる前のところで区切っています。");
          return;
        }
        router.replace(`/sessions/${session.id}/done`);
      })();
    },
    onSplit: () => {
      reopenWithNotice("15分以上ほかの画面にいたので、記録をそこで区切って、続きを始めました。");
    },
    onAccountSwitched: () => {
      setAccountSwitched(true);
      void untrack();
    },
  });

  // ---------------------------------------------------------------- 操作
  /** 退室する。next を渡すと、記録画面ではなくそのページへ移る */
  async function leave(next?: string) {
    if (!(await sameAccount(me.id))) {
      setAccountSwitched(true);
      return;
    }
    setLeaving(true);
    setError(null);
    const { data, error } = await createClient().rpc("leave_room");
    if (error) {
      setLeaving(false);
      if (error.message === "no_active_session") {
        router.replace(`/sessions/${session.id}/done`);
        return;
      }
      setError(rpcErrorMessage(error));
      return;
    }
    await untrack();
    router.push(next ?? `/sessions/${(data as { session_id: string }).session_id}/done`);
  }

  // 部屋の画面からほかのページへのリンクを押したら、退室してよいか聞く
  // （ページを離れるとハートビートが止まり、設定の分がたつと退室になるため）
  // 休憩中はページを離れても退室にならない（サーバーが休憩が終わるまで待つ）ので聞かない
  const leaveRef = useRef(leave);
  const onBreakRef = useRef(false);
  useEffect(() => {
    leaveRef.current = leave;
    onBreakRef.current = room.timer_mode === "pomodoro" && timer.kind === "break";
  });
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (onBreakRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (!window.confirm("ほかのページに移ると、部屋から退室したことになります。よろしいですか？")) return;
      void leaveRef.current(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  async function startTimer(): Promise<string | null> {
    const { data, error } = await createClient().rpc("start_timer", { p_room_id: room.id });
    if (error) return rpcErrorMessage(error);
    const startedAt = new Date(data as string).toISOString();
    setTimerStartedAt(startedAt);
    await sendTimer(startedAt);
    return null;
  }

  async function afterModeration(userId: string, action: "kick" | "ban" | "role") {
    await sendModeration(userId, action);
    if (action === "role") {
      await loadRoles();
    } else {
      setRemoved((s) => new Set(s).add(userId));
      setTarget(null);
    }
  }

  async function evacuate(): Promise<string | null> {
    const { error } = await createClient().rpc("evacuate_room", { p_room_id: room.id });
    if (error) return rpcErrorMessage(error);
    await sendModeration(me.id, "evacuate");
    return null;
  }

  async function deleteRoom(): Promise<string | null> {
    // 削除すると自分のセッションも閉じられ、この部屋のチャンネルに送れなくなるので、先に知らせる
    // （受け取った側は少し待ってから移動する。削除に失敗した場合は、記録画面から部屋に戻される）
    await sendModeration(me.id, "deleted");
    const { error } = await createClient().rpc("delete_room", { p_room_id: room.id });
    if (error) return rpcErrorMessage(error);
    await untrack();
    // 自分のセッションも閉じられているので、記録画面へ
    router.replace(`/sessions/${session.id}/done?removed=deleted-by-me`);
    return null;
  }

  async function changeTheme(next: RoomTheme): Promise<string | null> {
    const { error } = await createClient().rpc("set_room_theme", { p_room_id: room.id, p_theme: next });
    if (error) return rpcErrorMessage(error);
    setTheme(next);
    await sendModeration(me.id, "role"); // ほかの人の画面も取り直す
    return null;
  }

  const allowed = stampsAllowed(room.timer_mode, timer);
  const targetPresent = target !== null && members.some((m) => m.userId === target);

  async function stamp(id: StampId) {
    if (!targetPresent || !allowed) return;
    if (!claimStampSlot(lastSentRef)) return;
    setCooling(true);
    setTimeout(() => setCooling(false), STAMP_INTERVAL_MS);
    const ev: StampEvent = { id: crypto.randomUUID(), from: me.id, to: target!, stamp: id };
    playStamp(ev);
    await sendStamp(ev);
  }

  // ---------------------------------------------------------------- 表示用
  const celebrate = isCelebrating(timer);
  const seatMembers: SeatMember[] = [
    ...members.map((m) => ({
      ...m,
      official: officialIds.has(m.userId),
      focusMinutes: now === null ? 0 : continuousFocusMinutes(timer, Date.parse(m.joinedAt), now),
      stopwatchMs: m.stopwatch && now !== null ? stopwatchElapsed(m.stopwatch, now) : null,
      stopwatchRunning: m.stopwatch?.since != null,
      role: roles?.[m.userId] ?? (m.userId === room.owner_id ? ("owner" as const) : null),
    })),
    ...departed
      .filter((d) => !members.some((m) => m.userId === d.userId))
      .map((d) => ({ ...d, focusMinutes: 0, stopwatchMs: null, stopwatchRunning: false, role: null, leaving: true })),
  ];
  const everyoneCelebrates = celebrate && members.length >= 2 && members.every((m) => m.status !== "away");

  if (accountSwitched) {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-line bg-paper p-6 text-center shadow-sm">
        <p className="font-bold">このブラウザで、別のユーザーにログインし直されました</p>
        <p className="text-sm text-ink-soft">
          ログイン情報はブラウザのタブどうしで共有されるため、この部屋の画面（{me.displayName} さん）はここで止めました。
          2人で試すときは、ふつうのウィンドウとシークレットウィンドウ、または別のブラウザを使ってください。
        </p>
        <Button onClick={() => router.push("/lobby")}>ロビーへ</Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${hidden ? "anim-paused" : ""}`}>
      {idle.asking && <IdleDialog remainingMs={idle.remainingMs} avatar={me.avatar} seed={me.id} muted={muted} />}
      <header className="flex flex-col gap-3 rounded-3xl border border-line bg-paper p-4 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-2xl" aria-hidden>
            {room.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">{room.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2">
              <ConnectionBadge state={connection} />
              <RoomTomatoes roomId={room.id} />
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMuted}
            aria-pressed={muted}
            aria-label={muted ? "ミュート中（押すと音を鳴らす）" : "音あり（押すとミュート）"}
            title={muted ? "ミュート中" : audioOn ? "音あり" : "画面をクリックすると音が鳴るようになります"}
            className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-sm transition hover:bg-sakura/20"
          >
            {muted ? "🔕" : "🔔"}
          </button>
          {staffNow && room.visibility !== "public" && <CopyInviteButton code={room.invite_code} />}
          {staffNow && (
            <Button
              variant="ghost"
              className="shrink-0 px-2.5 py-1 text-xs"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              ⚙️<span className="hidden sm:inline"> 設定</span>
            </Button>
          )}
          <Button variant="secondary" onClick={() => void leave()} disabled={leaving} className="shrink-0 px-3 py-1.5 text-xs">
            {leaving ? "退室中…" : "退室する"}
          </Button>
        </div>
        <TimerPanel
          room={room}
          timer={timer}
          now={now}
          startedAt={session.started_at}
          stopwatch={stopwatch}
          onStopwatch={(action) => {
            if (!stopwatch) return;
            const t = clockNow(offset);
            updateStopwatch(
              action === "start" ? startStopwatch(stopwatch, t) : action === "stop" ? stopStopwatch(stopwatch, t) : STOPWATCH_ZERO,
            );
          }}
        />
        {staffNow && menuOpen && (
          <OwnerMenu
            onClose={() => setMenuOpen(false)}
            room={room}
            isOwner={myRole === "owner"}
            theme={theme}
            onChangeTheme={changeTheme}
            timerRunning={timerStartedAt !== null}
            onStartTimer={startTimer}
            onEvacuate={evacuate}
            onDeleteRoom={deleteRoom}
          />
        )}
      </header>

      <RoomScene theme={theme} now={now} onBreak={timer.kind === "break"}>
      <section aria-label="在室者" ref={seatsRef} className={`relative ${everyoneCelebrates ? "group-jump" : ""}`}>
        {everyoneCelebrates && (
          <p role="status" className="mb-3 text-center text-sm font-bold text-accent-strong">
            🎉 みんなでポモドーロ達成！
          </p>
        )}
        <Seats
          members={seatMembers}
          meId={me.id}
          selectedId={targetPresent ? target : null}
          onSelect={(id) => setTarget((cur) => (cur === id ? null : id))}
          celebrate={celebrate}
          hops={hops}
          looks={looks}
          emotes={emotes}
          deskStyle={ROOM_THEMES[theme].deskStyle}
          canSelect
        />
        {members.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">
            {connection === "error" ? "接続できませんでした。再読み込みしてください。" : "つないでいます…"}
          </p>
        )}
        {/* 飛んでいるスタンプ */}
        <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
          {flights.map((f) => (
            <div
              key={f.id}
              className="stamp-flight-x absolute"
              style={{ left: f.x - 20, top: f.y - 20, "--stamp-dx": `${f.dx}px` } as CSSProperties}
            >
              <div
                className="stamp-flight-y"
                style={{ "--stamp-dy": `${f.dy}px`, "--stamp-peak": `${f.peak}px` } as CSSProperties}
              >
                <StampArt id={f.stamp} avatar={(members.find((m) => m.userId === f.from) ?? departed.find((m) => m.userId === f.from))?.avatar} size={40} />
              </div>
            </div>
          ))}
        </div>
      </section>
      </RoomScene>

      {targetPresent && (
        <MemberActions
          roomId={room.id}
          target={{ userId: target!, displayName: members.find((m) => m.userId === target)?.displayName ?? "" }}
          myRole={myRole}
          targetRole={roles?.[target!] ?? (target === room.owner_id ? "owner" : null)}
          onDone={(action) => void afterModeration(target!, action)}
        />
      )}

      <footer className="flex flex-col gap-3 rounded-3xl border border-line bg-paper p-4 shadow-sm">
        <TaskEditor value={task} onChange={setTask} />
        {/* スタンプとエモート：丸いボタンを横に並べる（多いときは横にスクロール） */}
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setEmoteOpen((v) => !v)}
            aria-expanded={emoteOpen}
            aria-controls="emote-palette"
            aria-label="🎭 エモート"
            title="エモート"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl transition hover:scale-110 ${emoteOpen ? "bg-ink text-paper" : "bg-sakura/30 hover:bg-sakura/50"}`}
          >
            🎭
          </button>
          <span className="h-8 w-px shrink-0 bg-line" aria-hidden />
          {myStamps.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => stamp(s.id)}
              disabled={!allowed || !targetPresent || cooling}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream transition hover:scale-110 hover:bg-sakura/20 disabled:opacity-40 disabled:hover:scale-100"
              aria-label={`${s.label} スタンプを送る`}
              title={s.label}
            >
              <StampArt id={s.id} avatar={me.avatar} size={34} />
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
        <p className="text-xs text-ink-soft">
          {emoteCooling
            ? "少し待ってね…"
            : !allowed
              ? "🎭 エモートはいつでも、スタンプは休憩中に送れます"
              : targetPresent
                ? `${members.find((m) => m.userId === target)?.displayName} さんにスタンプを送る`
                : "🎭 で自分のもちが動きます。スタンプは送る相手のもちをタップ"}
        </p>
        {emoteOpen && (
          <div id="emote-palette" className="flex flex-col gap-2 rounded-2xl bg-cream p-2">
            {emoteGroups(EMOTES.filter((e) => canUseEmote(e.id, ownedSet))).map((g) => (
              <div key={g.group} className="flex flex-wrap items-center gap-1.5" role="group" aria-label={g.group}>
                <span className="w-14 shrink-0 text-xs text-ink-soft">{g.group}</span>
                {g.items.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => emote(e.id)}
                    disabled={emoteCooling}
                    className="rounded-full bg-paper px-3 py-1 text-sm shadow-sm transition hover:scale-105 hover:bg-sakura/20 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    <EmoteGlyph emote={e.id} size={14} className="mr-1 inline-block align-[-2px]" />
                    {e.label}
                  </button>
                ))}
              </div>
            ))}
            <Link href="/shop?kind=emote" className="self-end text-xs text-ink-soft underline">
              ショップでエモートをふやす
            </Link>
          </div>
        )}
        {notice && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-kinako/30 px-3 py-2 text-sm">
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-xs text-ink-soft hover:underline">
              とじる
            </button>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </footer>

      <details open={todos.some((t) => !t.done_at)} className="rounded-3xl border border-line bg-paper p-4 shadow-sm">
        <summary className="cursor-pointer font-bold">✅ ToDo</summary>
        <div className="mt-3">
          <TodoList initial={todos} compact />
        </div>
      </details>
    </div>
  );
}

function ConnectionBadge({ state }: { state: "connecting" | "live" | "error" }) {
  const map = {
    connecting: { text: "接続中…", cls: "bg-cream text-ink-soft" },
    live: { text: "● 接続中", cls: "bg-yomogi/25 text-green-800" },
    error: { text: "接続エラー", cls: "bg-red-50 text-red-700" },
  }[state];
  return <span className={`inline-block rounded-full px-2 text-[11px] leading-5 ${map.cls}`}>{map.text}</span>;
}

function TimerPanel({
  room,
  timer,
  now,
  startedAt,
  stopwatch,
  onStopwatch,
}: {
  room: Room;
  timer: TimerState;
  now: number | null;
  startedAt: string;
  stopwatch: Stopwatch | null;
  onStopwatch: (action: "start" | "stop" | "reset") => void;
}) {
  const elapsed = now === null ? 0 : now - Date.parse(startedAt);

  if (room.timer_mode === "free") {
    const running = stopwatch?.since != null;
    const swMs = stopwatch && now !== null ? stopwatchElapsed(stopwatch, now) : 0;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">⏱️ ストップウォッチ</span>
          <span className={`text-2xl font-bold tabular-nums ${running ? "" : "text-ink-soft"}`} aria-live="off">
            {formatClock(swMs)}
          </span>
          <div className="ml-auto flex gap-2">
            {running ? (
              <Button variant="secondary" className="px-4 py-1.5 text-sm" onClick={() => onStopwatch("stop")}>
                停止
              </Button>
            ) : (
              <Button className="px-4 py-1.5 text-sm" disabled={!stopwatch} onClick={() => onStopwatch("start")}>
                {swMs > 0 ? "再開" : "開始"}
              </Button>
            )}
            {!running && swMs > 0 && (
              <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => onStopwatch("reset")}>
                リセット
              </Button>
            )}
          </div>
        </div>
        <span className="text-xs text-ink-soft tabular-nums">
          🕊️ 自由モード・ストップウォッチは部屋のみんなにも見えます。あなたの在室時間 {formatClock(elapsed)}
        </span>
      </div>
    );
  }

  if (timer.kind === "idle") {
    return (
      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:justify-between">
        <span className="text-ink-soft">
          🍅 タイマーはまだ始まっていません（集中{room.focus_minutes}分・休憩{room.break_minutes}分）
        </span>
        <span className="self-end whitespace-nowrap tabular-nums sm:self-auto">
          あなたの学習時間 <b className="text-lg">{formatClock(elapsed)}</b>
        </span>
      </div>
    );
  }

  const isFocus = timer.kind === "focus";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col items-center gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <span className="text-sm font-bold">
          {isFocus ? "✏️ 集中" : "🍵 休憩"}・{timer.round}ラウンド目
          <span className="ml-2 text-xs font-normal text-ink-soft">完了 🍅×{timer.completedRounds}</span>
        </span>
        <span className="text-4xl font-bold tabular-nums sm:text-2xl" aria-live="off">
          {formatClock(timer.remainingMs)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-cream"
        role="progressbar"
        aria-label={isFocus ? "集中の進み具合" : "休憩の進み具合"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(timer.progress * 100)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${isFocus ? "bg-accent" : "bg-yomogi"}`}
          style={{ width: `${timer.progress * 100}%` }}
        />
      </div>
      <span className="text-right text-xs text-ink-soft tabular-nums">あなたの学習時間 {formatClock(elapsed)}</span>
    </div>
  );
}

function TaskEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = validateTask(draft);
        if (!v.ok) return setError(v.error);
        setError(null);
        onChange(v.value);
      }}
    >
      <label htmlFor="current-task" className="sr-only">
        今やること
      </label>
      <input
        id="current-task"
        value={draft}
        maxLength={TASK_MAX}
        onChange={(e) => setDraft(e.target.value)}
        className={`${inputClass} min-w-0 flex-1`}
        aria-describedby={error ? "task-error" : undefined}
      />
      <Button type="submit" variant="secondary" disabled={draft.trim() === value} className="shrink-0">
        更新
      </Button>
      {error && (
        <p id="task-error" role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}

const AWAY_AFTER_MS = 15 * 60_000;
const NOTICE_KEY = "mokumoku:room-notice";

type HiddenMember = { user_id: string; display_name: string; avatar: unknown; task: string; started_at: string; hidden_since: string };

/**
 * Presence の在室者に、タブが見えていない人（サーバーから取ったもの）を足す。
 * 見えなくなって15分をこえた人は「離席中」。Presence にいない人は、15分までは部屋の今の状態（集中中・休憩中）で出す
 */
function mergeHiddenMembers(
  presence: PresenceMeta[],
  hidden: HiddenMember[],
  myId: string,
  now: number | null,
  roomStatus: PresenceMeta["status"],
): PresenceMeta[] {
  if (hidden.length === 0 || now === null) return presence;
  const awayOf = (h: HiddenMember) => now - Date.parse(h.hidden_since) >= AWAY_AFTER_MS;
  const byId = new Map(hidden.filter((h) => h.user_id !== myId).map((h) => [h.user_id, h]));
  const merged = presence.map((m) => {
    const h = byId.get(m.userId);
    return h && awayOf(h) ? { ...m, status: "away" as const } : m;
  });
  for (const h of byId.values()) {
    if (merged.some((m) => m.userId === h.user_id)) continue;
    merged.push({
      userId: h.user_id,
      displayName: h.display_name,
      task: h.task,
      status: awayOf(h) ? "away" : roomStatus,
      joinedAt: h.started_at,
      avatar: parseAvatar(h.avatar),
      stopwatch: null,
      plantLevel: 1,
      updatedAt: 0,
    });
  }
  return merged.sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt) || a.userId.localeCompare(b.userId));
}

/** この部屋に集まっている🍅の数（だれでも見られる。みんなの勉強25分で1個。勉強中の分も入るので1分ごとに読み直す） */
function RoomTomatoes({ roomId }: { roomId: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await createClient().rpc("room_theme_shop", { p_room_id: roomId });
      const n = (data as { tomatoes?: number } | null)?.tomatoes;
      if (!cancelled && typeof n === "number") setCount(n);
    };
    const t = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearInterval(id);
    };
  }, [roomId]);
  if (count === null) return null;
  return (
    <span className="text-xs text-ink-soft" title="みんなの勉強25分で1個たまります" aria-label={`この部屋の🍅 ${count}個`}>
      🍅 {count}
    </span>
  );
}
