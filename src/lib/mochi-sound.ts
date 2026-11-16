/**
 * もちの部屋・着せかえの効果音。音のファイルは使わず、ブラウザの中（Web Audio）でその場で作る。
 * 静かに勉強する場所なので、最初は鳴らさない。鳴らすかどうかはこの端末に覚えておく
 */
import { useSyncExternalStore } from "react";

const KEY = "mokumoku.sound";
const VOLUME = 0.22;
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

/** 「さっ」「ぺち」の、ざらっとした短い音 */
function noise(a: AudioContext, opts: { dur: number; vol: number; cutoff: number; delay?: number }) {
  const t0 = a.currentTime + (opts.delay ?? 0);
  const len = Math.ceil(a.sampleRate * opts.dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = opts.cutoff;
  const gain = a.createGain();
  gain.gain.value = opts.vol;
  src.connect(filter).connect(gain).connect(master!);
  voices++;
  src.onended = () => voices--;
  src.start(t0);
}

/** 押したとき：「むにゅっ」 */
export function playPress() {
  const a = ready("press", 0.08);
  if (!a) return;
  tone(a, { from: 330, to: 170, dur: 0.22, vol: 0.7, attack: 0.03, cutoff: 900 });
  tone(a, { type: "triangle", from: 180, to: 110, dur: 0.18, vol: 0.25, attack: 0.03, cutoff: 600 });
}

/** 離したとき：「ぽよん」 */
export function playRelease() {
  const a = ready("release", 0.08);
  if (!a) return;
  tone(a, { from: 240, to: 520, dur: 0.09, vol: 0.6, cutoff: 1500 });
  tone(a, { from: 520, to: 380, dur: 0.2, vol: 0.45, delay: 0.08, cutoff: 1500 });
}

/** ぶつかったとき：床や壁は「ぺちっ」「ぽすっ」、天井は「ぽこっ」。勢いが強いほど大きく低い */
export function playBump(side: "bottom" | "top" | "left" | "right", speed: number) {
  const a = ready("bump", 0.06);
  if (!a) return;
  const p = Math.min(1, speed / 1800);
  const vol = 0.15 + p * 0.75;
  if (side === "top") {
    tone(a, { from: 720 - p * 160, to: 340, dur: 0.12, vol, cutoff: 2200 });
    return;
  }
  tone(a, { from: 210 - p * 90, to: 70, dur: 0.14 + p * 0.06, vol, cutoff: 700 });
  noise(a, { dur: 0.05, vol: vol * 0.5, cutoff: 1800 - p * 600 });
}

/** アクセサリーを付けたとき：「しゃらん」 */
export function playSparkle() {
  const a = ready("sparkle", 0.12);
  if (!a) return;
  [1320, 1760, 2090, 2640].forEach((f, i) => tone(a, { type: "triangle", from: f, to: f * 0.98, dur: 0.35, vol: 0.22, delay: i * 0.05, cutoff: 6000 }));
}

/** 家具を置いたとき：「ことっ」 */
export function playPlace() {
  const a = ready("place", 0.08);
  if (!a) return;
  tone(a, { type: "triangle", from: 520, to: 240, dur: 0.09, vol: 0.55, attack: 0.004, cutoff: 1600 });
  noise(a, { dur: 0.03, vol: 0.25, cutoff: 3000 });
}

// 引っぱっているあいだ：「みょーん」。伸びるほど高くなる
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
    lfo.frequency.value = 7;
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    osc.connect(gain).connect(master);
    osc.start(t);
    lfo.start(t);
    stretch = { osc, gain, lfo };
  }
  const k = Math.min(1, amount);
  stretch.osc.frequency.setTargetAtTime(200 + k * 360, t, 0.05);
  stretch.gain.gain.setTargetAtTime(0.12 + k * 0.25, t, 0.05);
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
