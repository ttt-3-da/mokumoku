/**
 * もちの部屋・着せかえの効果音。音のファイルは使わず、ブラウザの中（Web Audio）でその場で作る。
 * 静かに勉強する場所なので、最初は鳴らさない。鳴らすかどうかはこの端末に覚えておく
 */
import { useSyncExternalStore } from "react";

const KEY = "mokumoku.sound";
const VOLUME = 0.42;
const listeners = new Set<() => void>();
let enabled: boolean | null = null;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices = 0;
const lastPlayed: Record<string, number> = {};

function readEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(KEY) === "on";
    } catch {
      enabled = false;
    }
  }
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // 保存できなくても、このページのあいだは使える
  }
  if (on) audio(); // ボタンを押したときに音の準備をしておく（ブラウザは操作のときしか音を出させない）
  else stopStretch();
  listeners.forEach((l) => l());
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readEnabled,
    () => false,
  );
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 鳴らしてよいか。同じ音が続けて重ならないように、少し間をあける。同時に鳴る数も決めておく */
function ready(name: string, gap: number): AudioContext | null {
  if (!readEnabled()) return null;
  const a = audio();
  if (!a || !master) return null;
  const now = a.currentTime;
  if (now - (lastPlayed[name] ?? -1) < gap || voices >= 5) return null;
  lastPlayed[name] = now;
  return a;
}

/** 高さが from から to へ変わる、やわらかい音ひとつ */
function tone(a: AudioContext, opts: { type?: OscillatorType; from: number; to: number; dur: number; vol: number; delay?: number; attack?: number; cutoff?: number }) {
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  const filter = a.createBiquadFilter();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + opts.dur);
  filter.type = "lowpass";
  filter.frequency.value = opts.cutoff ?? 2400;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.vol), t0 + (opts.attack ?? 0.012));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(filter).connect(gain).connect(master!);
  voices++;
  osc.onended = () => voices--;
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

/** 押したとき：「むにゅっ」。高めで、少しゆれながら下がる */
export function playPress() {
  const a = ready("press", 0.08);
  if (!a) return;
  tone(a, { from: 620, to: 400, dur: 0.18, vol: 0.7, attack: 0.02, cutoff: 2600 });
  tone(a, { from: 1240, to: 800, dur: 0.12, vol: 0.18, attack: 0.02, cutoff: 3200 });
}

/** 離したとき：「ぽよん」。ぴょこっと上がって、もう一度はずむ */
export function playRelease() {
  const a = ready("release", 0.08);
  if (!a) return;
  tone(a, { from: 420, to: 980, dur: 0.08, vol: 0.65, cutoff: 3000 });
  tone(a, { from: 700, to: 1180, dur: 0.12, vol: 0.45, delay: 0.08, cutoff: 3000 });
}

/** ぶつかったとき：床や壁は「ぽてっ」、天井は「ぴこっ」。勢いが強いほど大きい */
export function playBump(side: "bottom" | "top" | "left" | "right", speed: number) {
  const a = ready("bump", 0.06);
  if (!a) return;
  const p = Math.min(1, speed / 1600);
  const vol = 0.3 + p * 0.7;
  if (side === "top") {
    tone(a, { from: 980, to: 1500, dur: 0.07, vol, cutoff: 4000 });
    tone(a, { from: 1500, to: 1300, dur: 0.06, vol: vol * 0.5, delay: 0.06, cutoff: 4000 });
    return;
  }
  const base = side === "bottom" ? 560 : 660;
  tone(a, { from: base - p * 120, to: base * 0.55, dur: 0.11, vol, cutoff: 2600 });
  tone(a, { from: base * 1.5, to: base * 1.9, dur: 0.06, vol: vol * 0.35, delay: 0.07, cutoff: 3600 });
}

/** アクセサリーを付けたとき：「きらりん」 */
export function playSparkle() {
  const a = ready("sparkle", 0.12);
  if (!a) return;
  [1047, 1319, 1568, 2093].forEach((f, i) => {
    tone(a, { from: f, to: f, dur: 0.4, vol: 0.3, delay: i * 0.055, attack: 0.005, cutoff: 7000 });
    tone(a, { type: "triangle", from: f * 2, to: f * 2, dur: 0.2, vol: 0.06, delay: i * 0.055, attack: 0.005, cutoff: 7000 });
  });
}

/** 家具を置いたとき：「ぽこっ」 */
export function playPlace() {
  const a = ready("place", 0.08);
  if (!a) return;
  tone(a, { from: 900, to: 560, dur: 0.08, vol: 0.6, attack: 0.004, cutoff: 3000 });
  tone(a, { from: 1350, to: 1100, dur: 0.05, vol: 0.2, delay: 0.05, attack: 0.004, cutoff: 3600 });
}

// 引っぱっているあいだ：「みょ〜ん」。伸びるほど高くなる
let stretch: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;

/** amount：0（伸びていない）〜1（伸びきった） */
export function setStretch(amount: number) {
  if (amount < 0.08) {
    stopStretch();
    return;
  }
  if (!readEnabled()) return;
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime;
  if (!stretch) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    const lfo = a.createOscillator();
    const lfoGain = a.createGain();
    osc.type = "sine";
    lfo.frequency.value = 6;
    lfoGain.gain.value = 22;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    osc.connect(gain).connect(master);
    osc.start(t);
    lfo.start(t);
    stretch = { osc, gain, lfo };
  }
  const k = Math.min(1, amount);
  stretch.osc.frequency.setTargetAtTime(420 + k * 620, t, 0.05);
  stretch.gain.gain.setTargetAtTime(0.14 + k * 0.22, t, 0.05);
}

export function stopStretch() {
  if (!stretch || !ctx) return;
  const s = stretch;
  stretch = null;
  const t = ctx.currentTime;
  s.gain.gain.setTargetAtTime(0.0001, t, 0.04);
  s.osc.stop(t + 0.25);
  s.lfo.stop(t + 0.25);
}
