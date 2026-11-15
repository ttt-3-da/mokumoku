/**
 * もちの体の輪郭（viewBox 100×100 の中、中心 50,62・横 34・縦 28）。
 * 点をなめらかにつないだ線で描くので、つまんだところだけを引っぱって体を曲げられる
 */
const CX = 50;
const CY = 62;
const RX = 34;
const RY = 28;
const N = 64;
const SPREAD = 0.42; // 引っぱられる範囲（輪郭の角度、ラジアン）

/** angle：輪郭のどこをつまんだか。dx, dy：どれだけ引っぱったか（viewBox の単位） */
export type Bulge = { angle: number; dx: number; dy: number };

function wrap(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** square は角の丸い四角（スーパー楕円）。bulge があれば、そのまわりだけ指のほうへ出っ張る */
export function bodyOutline(square: boolean, bulge?: Bulge | null): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let x = square ? CX + RX * Math.sign(c) * Math.abs(c) ** 0.4 : CX + RX * c;
    let y = square ? CY + RY * Math.sign(s) * Math.abs(s) ** 0.4 : CY + RY * s;
    if (bulge) {
      const d = wrap(t - bulge.angle);
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
