/**
 * もちの体の輪郭（viewBox 100×100 の中、中心 50,62・横 34・縦 28）。
 * 輪郭の点をばねでつないで動かす。つまむと、ほっぺをつねったようにそこだけ細く伸び、
 * 離すとぱちんと戻る。ぶつかると少しつぶれて揺れる
 */
export const CX = 50;
export const CY = 62;
const RX = 34;
const RY = 28;
export const OUTLINE_POINTS = 64;
const N = OUTLINE_POINTS;

/** angle：輪郭のどこをつまんだか。dx, dy：つまんだ場所から指までのずれ（viewBox の単位） */
export type Bulge = { angle: number; dx: number; dy: number };

/** 輪郭の点それぞれの、元の位置からのずれ（o）と速さ（v）。[x0, y0, x1, y1, ...] */
export type Jelly = { o: Float64Array; v: Float64Array };

export function newJelly(): Jelly {
  return { o: new Float64Array(N * 2), v: new Float64Array(N * 2) };
}

const restCache = new Map<boolean, Float64Array>();
/** 元の形の点。square は角の丸い四角（スーパー楕円） */
function rest(square: boolean): Float64Array {
  let r = restCache.get(square);
  if (r) return r;
  r = new Float64Array(N * 2);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    r[i * 2] = square ? CX + RX * Math.sign(c) * Math.abs(c) ** 0.4 : CX + RX * c;
    r[i * 2 + 1] = square ? CY + RY * Math.sign(s) * Math.abs(s) ** 0.4 : CY + RY * s;
  }
  restCache.set(square, r);
  return r;
}

function area(p: ArrayLike<number>): number {
  let a = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    a += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return a / 2;
}

function wrap(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const K_REST = 120; // 元の形に戻ろうとする強さ（ほっぺのように張りがある）
const K_NEIGHBOR = 300; // となりの点とそろおうとする強さ（なめらかさ）
const DAMP = 9; // 揺れのおさまりやすさ（離すとぱちんと戻って、少しだけ揺れる）
const K_PINCH = 600; // つまんだところが指についていく強さ
const PINCH_SPREAD = 0.34; // 指についていく範囲（せまいほど、つまんだところだけ細く伸びる）
const K_AREA = 1; // 体の広さを保とうとする強さ
const MAX_OFFSET = 120;

/**
 * 体ごと動いたときの勢いを、輪郭の点に伝える。dvx, dvy は体の速さの変化（viewBox の単位/秒）。
 * 体が急に止まると、進んでいた向きの側がそのまま進もうとして、べちゃっとつぶれる
 */
export function kickJelly(j: Jelly, square: boolean, dvx: number, dvy: number) {
  const len = Math.hypot(dvx, dvy);
  if (len < 1) return;
  const ux = dvx / len;
  const uy = dvy / len;
  const r = rest(square);
  for (let i = 0; i < N; i++) {
    const nx = (r[i * 2] - CX) / RX;
    const ny = (r[i * 2 + 1] - CY) / RY;
    // 速さが変わった向きの側（止まった壁の反対側）ほど大きく動く
    const w = 0.25 + 0.75 * Math.max(0, nx * ux + ny * uy);
    j.v[i * 2] -= dvx * 0.2 * w;
    j.v[i * 2 + 1] -= dvy * 0.2 * w;
  }
}

/** 1コマぶん進める。戻り値は揺れの大きさ（止まったかどうかの目安） */
export function stepJelly(j: Jelly, square: boolean, dt: number, pinch: Bulge | null): number {
  const r = rest(square);
  const a0 = area(r);
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  const p = new Float64Array(N * 2);
  let energy = 0;
  for (let step = 0; step < steps; step++) {
    for (let k = 0; k < N * 2; k++) p[k] = r[k] + j.o[k];
    const da = a0 - area(p);
    for (let i = 0; i < N; i++) {
      const ix = i * 2;
      const iy = ix + 1;
      const pi = ((i - 1 + N) % N) * 2;
      const ni = ((i + 1) % N) * 2;
      let fx = -K_REST * j.o[ix] + K_NEIGHBOR * (j.o[pi] + j.o[ni] - 2 * j.o[ix]) - DAMP * j.v[ix];
      let fy = -K_REST * j.o[iy] + K_NEIGHBOR * (j.o[pi + 1] + j.o[ni + 1] - 2 * j.o[iy]) - DAMP * j.v[iy];
      // 広さを保つ：輪郭の外向きに押したり引いたりする
      const tx = p[ni] - p[pi];
      const ty = p[ni + 1] - p[pi + 1];
      const tl = Math.hypot(tx, ty) || 1;
      fx += (K_AREA * da * ty) / tl / 10;
      fy += (K_AREA * da * -tx) / tl / 10;
      if (pinch) {
        const t = (i / N) * Math.PI * 2;
        const d = wrap(t - pinch.angle);
        const w = Math.exp(-(d * d) / (2 * PINCH_SPREAD * PINCH_SPREAD));
        // 持ち上げると、つまんでいない下のほうはだらんと垂れる
        const sag = Math.max(0, -pinch.dy) * 0.04 * Math.max(0, Math.sin(t)) * (1 - w);
        fx += K_PINCH * w * (pinch.dx * w - j.o[ix]);
        fy += K_PINCH * w * (pinch.dy * w - j.o[iy]) + K_REST * sag;
      }
      j.v[ix] += fx * h;
      j.v[iy] += fy * h;
    }
    for (let k = 0; k < N * 2; k++) {
      j.o[k] = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, j.o[k] + j.v[k] * h));
    }
  }
  for (let k = 0; k < N * 2; k++) energy += Math.abs(j.o[k]) + Math.abs(j.v[k]) * 0.1;
  return energy / N;
}

/** 輪郭の線。jelly があれば、その揺れ・伸びを入れて描く */
export function bodyOutline(square: boolean, jelly?: Jelly | null): string {
  const r = rest(square);
  const pt = (i: number): [number, number] => {
    const k = ((i + N) % N) * 2;
    return jelly ? [r[k] + jelly.o[k], r[k + 1] + jelly.o[k + 1]] : [r[k], r[k + 1]];
  };
  // Catmull-Rom を3次ベジェにして、閉じたなめらかな線にする
  const f = (n: number) => n.toFixed(1);
  const first = pt(0);
  let d = `M${f(first[0])} ${f(first[1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pt(i - 1);
    const p1 = pt(i);
    const p2 = pt(i + 1);
    const p3 = pt(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/**
 * 顔をどう動かすか：体の真ん中のずれと、つぶれ・伸びの具合。
 * 顔も体といっしょに流れて、べちゃっとつぶれたときは横に広がる
 */
export function faceTransform(square: boolean, j: Jelly): string {
  const r = rest(square);
  let cx = 0;
  let cy = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    const x = r[i * 2] + j.o[i * 2];
    const y = r[i * 2 + 1] + j.o[i * 2 + 1];
    cx += j.o[i * 2];
    cy += j.o[i * 2 + 1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  cx /= N;
  cy /= N;
  const sx = Math.min(1.06, Math.max(0.95, (maxX - minX) / (RX * 2)));
  const sy = Math.min(1.06, Math.max(0.95, (maxY - minY) / (RY * 2)));
  return `translate(${(CX + cx * 0.25).toFixed(2)} ${(CY + cy * 0.25).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-CX} ${-CY})`;
}

/** viewBox 上の点が、輪郭のどの角度にあたるか */
export function outlineAngle(x: number, y: number): number {
  const a = Math.atan2((y - CY) / RY, (x - CX) / RX);
  return a < 0 ? a + Math.PI * 2 : a;
}
