"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Avatar } from "@/lib/avatar";
import { parseEmoteEvent, type EmoteEvent } from "@/lib/emotes";
import type { Stopwatch } from "@/lib/stopwatch";
import { flattenPresence } from "@/lib/presence";
import { parseStampEvent, type StampEvent } from "@/lib/room-logic";
import { createClient } from "@/lib/supabase/client";
import type { PresenceMeta, PresenceStatus } from "@/lib/types";

export type ConnectionState = "connecting" | "live" | "error";

type Self = {
  userId: string;
  displayName: string;
  task: string;
  status: PresenceStatus;
  joinedAt: string;
  avatar: Avatar;
  stopwatch: Stopwatch | null;
  plantLevel: 1 | 2 | 3;
};

type Handlers = {
  /** 他の人からスタンプが届いた */
  onStamp: (ev: StampEvent) => void;
  /** だれかがエモートをした */
  onEmote: (ev: EmoteEvent) => void;
  /** タイマーが（やり直しを含めて）開始された */
  onTimer: (startedAt: string) => void;
  /** 接続・再接続できた（取りこぼしたイベントを DB から取り直すため） */
  onSubscribed: () => void;
  /** オーナー・モデレーターがだれかをキック・BAN した（役割の変更も含めて画面を更新する合図） */
  onModeration: (ev: { userId: string; action: "kick" | "ban" | "role" }) => void;
};

/**
 * private channel `room:{roomId}` に参加する。
 * - Presence：在室者・今やること・状態・アバター
 * - Broadcast：スタンプ、タイマー開始、キック・BAN・役割変更の通知
 * チャンネルへの参加可否は realtime.messages の RLS（その部屋に入室中の人だけ）で判定される。
 */
export function useRoomChannel({ roomId, self, handlers }: { roomId: string; self: Self; handlers: Handlers }) {
  const [members, setMembers] = useState<PresenceMeta[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [reconnectKey, setReconnectKey] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const metaRef = useRef<PresenceMeta | null>(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { private: true, presence: { key: self.userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        setMembers(flattenPresence(channel.presenceState()));
      })
      .on("broadcast", { event: "stamp" }, ({ payload }) => {
        const ev = parseStampEvent(payload);
        if (ev) handlersRef.current.onStamp(ev);
      })
      .on("broadcast", { event: "emote" }, ({ payload }) => {
        const ev = parseEmoteEvent(payload);
        if (ev) handlersRef.current.onEmote(ev);
      })
      .on("broadcast", { event: "moderation" }, ({ payload }) => {
        const p = payload as { userId?: unknown; action?: unknown };
        if (typeof p?.userId === "string" && (p.action === "kick" || p.action === "ban" || p.action === "role")) {
          handlersRef.current.onModeration({ userId: p.userId, action: p.action });
        }
      })
      .on("broadcast", { event: "timer" }, ({ payload }) => {
        const startedAt = (payload as { startedAt?: unknown })?.startedAt;
        if (typeof startedAt === "string" && !Number.isNaN(Date.parse(startedAt))) {
          handlersRef.current.onTimer(startedAt);
        }
      });

    (async () => {
      // private channel は JWT で認可されるので、購読前にトークンを渡す
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          // 再接続時にも自分の状態を送り直す
          if (metaRef.current) void channel.track(metaRef.current);
          handlersRef.current.onSubscribed();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("error");
        }
      });
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomId, self.userId, reconnectKey]);

  // タブに戻ってきたとき：トークンを最新にして、つながっていれば在室を伝え直す。
  // 切れたままならチャンネルを作り直す（上の effect が reconnectKey で走り直す）
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== "visible") return;
      const channel = channelRef.current;
      await createClient().realtime.setAuth();
      if (channel && channel.state === "joined") {
        if (metaRef.current) {
          metaRef.current = { ...metaRef.current, updatedAt: Date.now() };
          void channel.track(metaRef.current);
        }
      } else if (channel && channel.state !== "joining") {
        setConnection("connecting");
        setReconnectKey((k) => k + 1);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  // 状態・今やること・アバター・ストップウォッチが変わったら track し直す
  const { userId, displayName, task, status, joinedAt, avatar, stopwatch, plantLevel } = self;
  const avatarKey = JSON.stringify(avatar);
  const stopwatchKey = JSON.stringify(stopwatch);
  useEffect(() => {
    metaRef.current = {
      userId,
      displayName,
      task,
      status,
      joinedAt,
      avatar: JSON.parse(avatarKey) as Avatar,
      stopwatch: JSON.parse(stopwatchKey) as Stopwatch | null,
      plantLevel,
      updatedAt: Date.now(),
    };
    if (connection === "live") void channelRef.current?.track(metaRef.current);
  }, [userId, displayName, task, status, joinedAt, avatarKey, stopwatchKey, plantLevel, connection]);

  async function send(event: "stamp" | "emote" | "timer" | "moderation", payload: Record<string, unknown>) {
    await channelRef.current?.send({ type: "broadcast", event, payload });
  }

  async function untrack() {
    await channelRef.current?.untrack();
  }

  return {
    members,
    connection,
    untrack,
    sendStamp: (ev: StampEvent) => send("stamp", ev),
    sendEmote: (ev: EmoteEvent) => send("emote", ev),
    sendTimer: (startedAt: string) => send("timer", { startedAt }),
    sendModeration: (userId: string, action: "kick" | "ban" | "role") => send("moderation", { userId, action }),
  };
}
