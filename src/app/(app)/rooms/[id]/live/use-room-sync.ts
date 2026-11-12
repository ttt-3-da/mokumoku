"use client";

import { useEffect, useRef, useState } from "react";
import { clockOffset } from "@/lib/room-logic";
import { createClient } from "@/lib/supabase/client";

/**
 * サーバー時刻との差を測る（3回測って往復時間が一番短いものを使う）。
 * タイマーの残り時間はこの差を足した「サーバー基準の今」で計算する。
 */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const samples: { t0: number; t1: number; server: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        const { data, error } = await supabase.rpc("server_now");
        const t1 = Date.now();
        if (error || typeof data !== "string") continue;
        samples.push({ t0, t1, server: Date.parse(data) });
      }
      if (!cancelled && samples.length > 0) setOffset(clockOffset(samples));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return offset;
}

export const HEARTBEAT_MS = 60_000;

type HeartbeatResult = { session_id: string; room_id: string; timer_started_at: string | null };

/**
 * 60秒ごとにハートビートを送る（タブが非表示でも送る。離席中も学習時間に含めるため）。
 * ブラウザを閉じるとハートビートが止まり、3分後に cron がセッションを閉じる。
 * - task が変わったらすぐに送って DB にも保存する
 * - セッションがもう閉じられていたら onLost を呼ぶ
 */
export function useHeartbeat({
  userId,
  task,
  enabled,
  onBeat,
  onLost,
  onAccountSwitched,
}: {
  userId: string;
  task: string;
  enabled: boolean;
  onBeat: (r: HeartbeatResult) => void;
  onLost: () => void;
  /** 同じブラウザの別タブで、別のユーザーにログインし直された */
  onAccountSwitched: () => void;
}) {
  const cbRef = useRef({ onBeat, onLost, onAccountSwitched });
  const taskRef = useRef(task);
  useEffect(() => {
    cbRef.current = { onBeat, onLost, onAccountSwitched };
  });

  // ログイン情報（Cookie）はタブ間で共有される。別タブで別のユーザーにログインすると、
  // この画面から送る RPC がそのユーザーとして実行されてしまうので、送る前とタブに戻ったときに確かめる
  useEffect(() => {
    if (!enabled) return;
    const check = () => void sameAccount(userId).then((ok) => ok || cbRef.current.onAccountSwitched());
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    async function beat(withTask: string | null) {
      if (!(await sameAccount(userId))) {
        stopped = true;
        cbRef.current.onAccountSwitched();
        return;
      }
      if (stopped) return;
      const { data, error } = await createClient().rpc("heartbeat", { p_task: withTask });
      if (stopped) return;
      if (error) {
        if (error.message === "no_active_session") {
          stopped = true;
          cbRef.current.onLost();
        }
        return; // 通信エラーは次の回に任せる
      }
      cbRef.current.onBeat(data as HeartbeatResult);
    }

    // 「今やること」が変わったときだけ task 付きで送る
    const taskChanged = taskRef.current !== task;
    taskRef.current = task;
    if (taskChanged) void beat(task);

    const id = setInterval(() => void beat(null), HEARTBEAT_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [task, userId, enabled]);
}

/** 今のブラウザのログインユーザーが、この画面を開いたユーザーと同じか */
export async function sameAccount(userId: string): Promise<boolean> {
  const { data } = await createClient().auth.getClaims();
  return data?.claims?.sub === userId;
}
