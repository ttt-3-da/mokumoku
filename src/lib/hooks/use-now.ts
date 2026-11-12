"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 現在時刻を intervalMs 単位で返すフック。
 * サーバーと初回ハイドレーション時は null を返すので、時刻のズレによる
 * ハイドレーションエラーが起きない。offsetMs でサーバー時刻との差を補正できる。
 */
export function useNow(intervalMs = 1000, offsetMs = 0): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs],
  );
  // 同じ区間内では同じ値を返す（useSyncExternalStore は値が安定している必要がある）
  const getSnapshot = () => Math.floor((Date.now() + offsetMs) / intervalMs) * intervalMs;
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
