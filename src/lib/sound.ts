"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 効果音。外部の音声ファイルは使わず、Web Audio API でその場で合成する（素材はすべてオリジナル）。
 * ブラウザは、ページ上でクリックなどの操作があるまで音を出させないので、最初の操作で鳴らせる状態にする。
 */

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

/** 鳴らす音の種類 */
export const SOUNDS = {
  // 休憩に入った：やわらかく下がるチャイム
  breakStart: [
    { freq: 1046.5, at: 0, dur: 0.5 },
    { freq: 783.99, at: 0.22, dur: 0.7 },
  ],
  // 休憩が終わった（集中に戻る）：明るく上がるチャイム
  breakEnd: [
    { freq: 783.99, at: 0, dur: 0.35 },
    { freq: 1046.5, at: 0.16, dur: 0.35 },
    { freq: 1318.5, at: 0.32, dur: 0.6 },
  ],
  // エモート：「ぽこっ」
  emote: [
    { freq: 587.33, at: 0, dur: 0.18, type: "triangle", gain: 0.32 },
    { freq: 880, at: 0.09, dur: 0.28, type: "triangle", gain: 0.28 },
  ],
  // 「まだ勉強中？」：ぽーん、ぽーん
  idleAsk: [
    { freq: 880, at: 0, dur: 0.5 },
    { freq: 880, at: 0.7, dur: 0.6 },
  ],
  // お祝い（買った・バッジ・目標達成）：ド・ミ・ソ・ド
  cheer: [
    { freq: 523.25, at: 0, dur: 0.18, type: "triangle", gain: 0.3 },
    { freq: 659.25, at: 0.1, dur: 0.18, type: "triangle", gain: 0.3 },
    { freq: 783.99, at: 0.2, dur: 0.2, type: "triangle", gain: 0.3 },
    { freq: 1046.5, at: 0.32, dur: 0.45, type: "triangle", gain: 0.28 },
  ],
  // スタンプが届いた：キラッ
  stamp: [
    { freq: 1567.98, at: 0, dur: 0.14, type: "triangle", gain: 0.26 },
    { freq: 2093, at: 0.08, dur: 0.26, type: "triangle", gain: 0.22 },
  ],
} satisfies Record<string, Note[]>;

export type SoundName = keyof typeof SOUNDS;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** 音を鳴らせる状態か（ページで一度操作があったか） */
export function audioReady(): boolean {
  return getContext()?.state === "running";
}

/**
 * 最初のクリック・キー操作で音を鳴らせる状態にする。鳴らせるようになったら onReady を呼ぶ。
 * 戻り値は後片付け用の関数。
 */
export function unlockAudio(onReady: () => void): () => void {
  const c = getContext();
  if (!c) return () => {};
  const tryResume = () => {
    void c.resume().then(() => {
      if (c.state === "running") onReady();
    });
  };
  // 前のページのクリックで、すでに鳴らせることもある
  tryResume();
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  events.forEach((e) => window.addEventListener(e, tryResume, { passive: true }));
  c.addEventListener("statechange", tryResume);
  return () => {
    events.forEach((e) => window.removeEventListener(e, tryResume));
    c.removeEventListener("statechange", tryResume);
  };
}

/**
 * 音を鳴らす。delaySec 秒後に予約もできる（音声の時計で予約するので、見ていないタブでも時間どおりに鳴る）。
 * まだ音の準備ができていない（ページで最初のクリックの直後など）ときは、準備ができるのを待ってから鳴らす。
 * 戻り値で、まだ鳴っていない予約を取り消せる。
 */
export function playSound(name: SoundName, delaySec = 0): () => void {
  const c = getContext();
  if (!c) return () => {};
  let cancelled = false;
  let cancelScheduled: (() => void) | null = null;
  const run = () => {
    if (cancelled || c.state !== "running") return;
    cancelScheduled = schedule(c, name, delaySec);
  };
  if (c.state === "running") run();
  else void c.resume().then(run, () => {});
  return () => {
    cancelled = true;
    cancelScheduled?.();
  };
}

function schedule(c: AudioContext, name: SoundName, delaySec: number): () => void {
  const start = c.currentTime + Math.max(0, delaySec);
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);

  const oscillators = (SOUNDS[name] as Note[]).map((n) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.freq;
    const t0 = start + n.at;
    const peak = n.gain ?? 0.18;
    // ぷつっと鳴らないよう、すっと立ち上がってゆっくり消える
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + n.dur + 0.05);
    return osc;
  });

  // 取り消せるのは、まだ鳴り始めていない予約だけ（鳴っている途中の音は最後まで鳴らす）
  return () => {
    if (c.currentTime >= start) return;
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        // すでに止まっている
      }
    }
    master.disconnect();
  };
}
// ---------------------------------------------------------------- ミュート設定（このブラウザに保存）

const MUTE_KEY = "mokumoku:muted";
const listeners = new Set<() => void>();

// localStorage が使えない環境（プライベートブラウズなど）では、このページを開いている間だけ覚える
let memoryMuted = false;

function readMuted(): boolean {
  try {
    const v = localStorage.getItem(MUTE_KEY);
    return v === null ? memoryMuted : v === "1";
  } catch {
    return memoryMuted;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === MUTE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** ミュート状態。サーバーと初回表示では「ミュートしていない」として扱う */
export function useMuted(): [boolean, () => void] {
  const muted = useSyncExternalStore(subscribe, readMuted, () => false);
  const toggle = useCallback(() => {
    const next = !readMuted();
    memoryMuted = next;
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      // 保存できなくても、このページを開いている間は切り替わる
    }
    listeners.forEach((l) => l());
  }, []);
  return [muted, toggle];
}
