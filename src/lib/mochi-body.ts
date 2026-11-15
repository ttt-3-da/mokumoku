/**
 * もちの体の輪郭（viewBox 100×100 の中、中心 50,62・横 34・縦 28）。
 * 点をなめらかにつないだ線で描くので、つまんだところだけを出っ張らせられる
 */
const CX = 50;
const CY = 62;
const RX = 34;
const RY = 28;
const N = 48;
const SPREAD = 0.4; // 出っ張る範囲（輪郭の角度、ラジアン）

/** angle：輪郭のどこをつまんだか。dx, dy：その場所をどれだけ引き出すか（viewBox の単位） */
export type Bulge = { angle: number; dx: number; dy: number };

/** square は角の丸い四角（スーパー楕円）。bulge があれば、そのまわりだけ出っ張る */
export function bodyOutline(square: boolean, bulge?: Bulge | null): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let x = square ? CX + RX * Math.sign(c) * Math.abs(c) ** 0.4 : CX + RX * c;
    let y = square ? CY + RY * Math.sign(s) * Math.abs(s) ** 0.4 : CY + RY * s;
    if (bulge) {
      const d = Math.atan2(Math.sin(t - bulge.angle), Math.cos(t - bulge.angle));
      const w = Math.exp(-(d * d) / (2 * SPREAD * SPREAD));
      x += w * bulge.dx;
      y += w * bulge.dy;
    }
    pts.push([x, y]);
  }
  // Catmull-Rom を3次ベジェにして、閉じたなめらかな線にする
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** viewBox 上の点が、輪郭のどの角度にあたるか */
export function outlineAngle(x: number, y: number): number {
  return Math.atan2((y - CY) / RY, (x - CX) / RX);
}

/** 輪郭のその角度での、外向きの向き（長さ1） */
export function outlineNormal(angle: number): [number, number] {
  const nx = Math.cos(angle) / RX;
  const ny = Math.sin(angle) / RY;
  const l = Math.hypot(nx, ny) || 1;
  return [nx / l, ny / l];
}

/**
 * 引っぱられたときの顔やアクセサリーの動き。つまんだ側ほど大きく引っぱる向きへずれて、その向きに少し伸びる。
 * 伸ばす中心を反対側に置くので、つまんだ側の目やほっぺのほうがよく動く
 */
export function faceStretch(bulge: Bulge): string {
  const len = Math.hypot(bulge.dx, bulge.dy);
  if (len < 0.3) return "";
  const ux = bulge.dx / len;
  const uy = bulge.dy / len;
  const st = Math.min(0.22, len / 180); // 伸びる割合
  const deg = (Math.atan2(uy, ux) * 180) / Math.PI;
  const ox = CX - ux * 18;
  const oy = CY - uy * 14;
  const f = (n: number) => n.toFixed(2);
  return `translate(${f(ox + bulge.dx * 0.08)} ${f(oy + bulge.dy * 0.08)}) rotate(${f(deg)}) scale(${f(1 + st)} ${f(1 - st * 0.35)}) rotate(${f(-deg)}) translate(${f(-ox)} ${f(-oy)})`;
}
