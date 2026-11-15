"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { FurnitureArt } from "@/components/furniture-art";
import { Mochi } from "@/components/mochi";
import { FORM_STACK, FORM_STACK_STEP, type Avatar } from "@/lib/avatar";
import { bodyOutline, outlineAngle, type Bulge } from "@/lib/mochi-body";
import { rpcErrorMessage } from "@/lib/errors";
import {
  FURNITURE,
  MAX_ROOM_ITEMS,
  ownsFurniture,
  ownsWallpaper,
  stepBounce,
  WALLPAPERS,
  type FurnitureId,
  type PlacedItem,
  type WallpaperId,
} from "@/lib/mochi-room";
import { createClient } from "@/lib/supabase/client";

type Props = {
  avatar: Avatar;
  seed: string;
  displayName: string;
  isMe: boolean;
  wallpaper: WallpaperId;
  items: PlacedItem[];
  owned: string[];
};

/**
 * もちの部屋。もちをタップするとつぶれる、ドラッグすると伸びながらついてくる、
 * 勢いよく離すと部屋の中を跳ねまわる。自分の部屋なら壁紙と家具を模様がえできる
 */
export function MochiRoom({ avatar, seed, displayName, isMe, wallpaper: initialWallpaper, items: initialItems, owned }: Props) {
  const ownedSet = new Set(owned);
  const [wallpaper, setWallpaper] = useState(initialWallpaper);
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------- 家具を動かす
  const dragItem = useRef<{ index: number; dx: number; dy: number } | null>(null);
  function onItemDown(e: ReactPointerEvent, index: number) {
    if (!editing || !roomRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const r = roomRef.current.getBoundingClientRect();
    const it = items[index];
    dragItem.current = { index, dx: ((e.clientX - r.left) / r.width) * 100 - it.x, dy: ((e.clientY - r.top) / r.height) * 100 - it.y };
    setSelected(index);
  }
  function onItemMove(e: ReactPointerEvent) {
    const d = dragItem.current;
    if (!d || !roomRef.current) return;
    const r = roomRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100 - d.dx));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100 - d.dy));
    setItems((list) => list.map((it, i) => (i === d.index ? { ...it, x, y } : it)));
  }
  function onItemUp() {
    dragItem.current = null;
  }

  function addItem(id: FurnitureId) {
    if (items.length >= MAX_ROOM_ITEMS) return;
    setItems((list) => [...list, { id, x: 40 + Math.random() * 20, y: 50 }]);
    setSelected(items.length);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const { error } = await createClient().rpc("save_mochi_room", { p_wallpaper: wallpaper, p_items: items });
    setSaving(false);
    if (error) {
      setMessage({ ok: false, text: rpcErrorMessage(error) });
      return;
    }
    setMessage({ ok: true, text: "保存しました" });
    setEditing(false);
    setSelected(null);
  }

  // ---------------------------------------------------------------- もちの動き
  // もちの大きさは部屋の幅に合わせる（スマホでも大きすぎないように）
  const [SIZE, setSize] = useState(96);
  const sizeRef = useRef(96);
  const mochiRef = useRef<HTMLDivElement>(null);
  const body = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const mode = useRef<"rest" | "drag" | "fly">("rest");
  const grab = useRef({ ox: 0, oy: 0, lastX: 0, lastY: 0, lastT: 0, startX: 0, startY: 0, moved: false, vx: 0, vy: 0 });
  // つまんでいるあいだ、もちが行きたい場所（指の位置）。体はあとからついてくる
  const pull = useRef({ tx: 0, ty: 0 });
  // つまんだ場所（もちの箱の中の位置）。そこだけ体が指のほうへ曲がって出っ張る
  const pinch = useRef({ ax: 0, ay: 0, active: false });
  const bent = useRef(false);
  const form = avatar.form ?? "round";
  // anchor：つまんで引っぱっているとき。うしろ側を残して、指の向きにだけ伸びる
  const stretch = useRef({ angle: 0, k: 0, anchor: false });
  const [squish, setSquish] = useState(0);
  const raf = useRef<number | null>(null);

  const paint = useCallback(() => {
    const el = mochiRef.current;
    if (!el) return;
    const { x, y } = body.current;
    const { angle, k, anchor } = stretch.current;
    const s = sizeRef.current;
    // 引っぱっているときは、伸びたぶんだけ指のほうへずらす（うしろ側はその場に残る）
    const shift = anchor ? (k * s) / 2 : 0;
    const sx = x + Math.cos(angle) * shift;
    const sy = y + Math.sin(angle) * shift;
    // 動く向きに伸びて、そのぶん細くなる（つままれてびよーんと伸びる）
    const thin = anchor ? 1 / Math.sqrt(1 + k * 1.4) : 1 - k * 0.45;
    el.style.transform = `translate(${sx}px, ${sy}px) rotate(${angle}rad) scale(${1 + k}, ${thin}) rotate(${-angle}rad)`;

    // つまんだところだけ、体の輪郭が指のほうへ曲がって出っ張る
    const bodies = el.querySelectorAll<SVGPathElement>("[data-mochi-body]");
    const pc = pinch.current;
    const square = form === "square";
    if (!pc.active) {
      if (bent.current) {
        bodies.forEach((b) => b.setAttribute("d", bodyOutline(square)));
        bent.current = false;
      }
      return;
    }
    const hit = toBody(pc.ax, pc.ay, pull.current.tx - x, pull.current.ty - y, s, form);
    bodies.forEach((b) => b.setAttribute("d", bodyOutline(square, Number(b.dataset.mochiBody) === hit.copy ? hit.bulge : null)));
    bent.current = true;
  }, [form]);

  const roomSize = useCallback(() => {
    const r = roomRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 300, h: r?.height ?? 300 };
  }, []);

  useEffect(() => {
    const el = roomRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const s = Math.round(Math.min(160, Math.max(72, el.clientWidth * 0.17)));
      sizeRef.current = s;
      setSize(s);
      // 止まっているもちは、新しい大きさで床に立たせる
      if (mode.current === "rest") {
        body.current.x = Math.min(body.current.x, Math.max(0, el.clientWidth - s));
        body.current.y = el.clientHeight - s - 8;
        paint();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [paint]);

  // 最初は床の真ん中に置く
  useEffect(() => {
    const { w, h } = roomSize();
    const s = sizeRef.current;
    body.current = { x: w / 2 - s / 2, y: h - s - 8, vx: 0, vy: 0 };
    paint();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [paint, roomSize]);

  const fly = useCallback(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const { w, h } = roomSize();
      const s = sizeRef.current;
      const next = stepBounce(body.current, dt, w, h, s);
      body.current = { x: next.x, y: next.y, vx: next.vx, vy: next.vy };
      const speed = Math.hypot(next.vx, next.vy);
      stretch.current = next.hit
        ? { angle: Math.atan2(next.vy, next.vx) + Math.PI / 2, k: 0.25, anchor: false }
        : { angle: Math.atan2(next.vy, next.vx), k: Math.min(0.35, speed / 3000), anchor: false };
      paint();
      const resting = next.y >= h - s - 0.5 && Math.abs(next.vx) < 8 && next.vy === 0;
      if (mode.current === "fly" && !resting) {
        raf.current = requestAnimationFrame(tick);
      } else {
        mode.current = "rest";
        stretch.current = { angle: 0, k: 0, anchor: false };
        paint();
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, [paint, roomSize]);

  // つまんでいるあいだ：体はゆっくり指を追いかけ、離れたぶんだけびよーんと伸びる
  const dragLoop = useCallback(() => {
    let last = performance.now();
    const tick = (now: number) => {
      if (mode.current !== "drag") return;
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = sizeRef.current;
      const b = body.current;
      const t = pull.current;
      // 体はほとんどその場に残り、出っ張りが伸びきると体ごと引っぱられる
      const f = 1 - Math.exp(-dt * 0.6);
      const { w: rw, h: rh } = roomSize();
      b.x = Math.min(rw - s, Math.max(0, b.x + (t.tx - b.x) * f));
      b.y = Math.min(rh - s, Math.max(0, b.y + (t.ty - b.y) * f));
      let dx = t.tx - b.x;
      let dy = t.ty - b.y;
      let d = Math.hypot(dx, dy);
      // 伸びすぎたら体ごと引っぱられる
      const max = s * 0.75;
      if (d > max) {
        b.x = t.tx - (dx / d) * max;
        b.y = t.ty - (dy / d) * max;
        dx = t.tx - b.x;
        dy = t.ty - b.y;
        d = max;
      }
      // 体はほんの少しだけ指のほうへ伸びる（大きく伸びるのは、つまんだところ）
      stretch.current = d > 0.5 ? { angle: Math.atan2(dy, dx), k: Math.min(0.06, (d / s) * 0.06), anchor: true } : { angle: 0, k: 0, anchor: false };
      paint();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [paint, roomSize]);

  function onMochiDown(e: ReactPointerEvent) {
    if (editing || !roomRef.current) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (raf.current) cancelAnimationFrame(raf.current);
    const r = roomRef.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    mode.current = "drag";
    grab.current = { ox: px - body.current.x, oy: py - body.current.y, lastX: px, lastY: py, lastT: performance.now(), startX: px, startY: py, moved: false, vx: 0, vy: 0 };
    pull.current = { tx: body.current.x, ty: body.current.y };
    pinch.current = { ax: px - body.current.x, ay: py - body.current.y, active: true };
    body.current.vx = 0;
    body.current.vy = 0;
    dragLoop();
  }

  function onMochiMove(e: ReactPointerEvent) {
    if (mode.current !== "drag" || !roomRef.current) return;
    const r = roomRef.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const g = grab.current;
    const now = performance.now();
    const dt = Math.max(1, now - g.lastT) / 1000;
    // 指の速さはなめらかにならす（離したときに投げる勢い）
    g.vx = g.vx * 0.6 + ((px - g.lastX) / dt) * 0.4;
    g.vy = g.vy * 0.6 + ((py - g.lastY) / dt) * 0.4;
    g.lastX = px;
    g.lastY = py;
    g.lastT = now;
    if (Math.hypot(px - g.startX, py - g.startY) > 6) g.moved = true;
    // 出っ張りの先が指の位置になるように（つまんだ場所の分だけずらす）
    const pc = pinch.current;
    pull.current = {
      tx: Math.min(r.width - pc.ax, Math.max(-pc.ax, px - pc.ax)),
      ty: Math.min(r.height - pc.ay, Math.max(-pc.ay, py - pc.ay)),
    };
  }

  function onMochiUp() {
    if (mode.current !== "drag") return;
    pinch.current.active = false;
    const g = grab.current;
    if (!g.moved) {
      // タップ：むにっとつぶれる
      body.current.vx = 0;
      body.current.vy = 0;
      stretch.current = { angle: 0, k: 0, anchor: false };
      mode.current = "fly";
      setSquish((n) => n + 1);
      fly();
      return;
    }
    // 離すと、伸びていたぶん指のほうへぽよんと戻る。勢いよく投げていればそのまま飛んでいく
    const b = body.current;
    const t = pull.current;
    const speed = Math.hypot(g.vx, g.vy);
    const keep = speed < 400 ? 0.3 : 1;
    b.vx = g.vx * keep + (t.tx - b.x) * 6;
    b.vy = g.vy * keep + (t.ty - b.y) * 6;
    mode.current = "fly";
    fly();
  }

  const wp = WALLPAPERS[wallpaper];
  const furnitureList = Object.keys(FURNITURE) as FurnitureId[];
  const wallpaperList = Object.keys(WALLPAPERS) as WallpaperId[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{isMe ? "もちの部屋" : `${displayName} さんのもちの部屋`}</h1>
        {isMe && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto rounded-full bg-paper px-4 py-1.5 text-sm font-bold shadow-sm hover:bg-sakura/20">
            🪑 模様がえ
          </button>
        )}
        {isMe && editing && (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setWallpaper(initialWallpaper);
                setItems(initialItems);
                setEditing(false);
                setSelected(null);
              }}
              className="rounded-full px-4 py-1.5 text-sm text-ink-soft hover:bg-cream"
            >
              やめる
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white hover:bg-accent-strong disabled:opacity-50">
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        )}
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <div
        ref={roomRef}
        className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-3xl border border-line shadow-sm sm:aspect-[16/9]"
        style={{ background: wp.bg }}
        onPointerMove={(e) => {
          onItemMove(e);
          onMochiMove(e);
        }}
        onPointerUp={() => {
          onItemUp();
          onMochiUp();
        }}
        onPointerCancel={() => {
          onItemUp();
          onMochiUp();
        }}
        onPointerDown={() => editing && setSelected(null)}
      >
        {/* 床 */}
        <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[#d8b58c]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 60px, #c9a274 60px 62px)" }} aria-hidden />

        {items.map((it, i) => (
          <div
            key={i}
            className={`absolute ${editing ? "cursor-grab" : "pointer-events-none"} ${selected === i ? "outline-2 outline-dashed outline-accent" : ""}`}
            style={{ left: `${it.x}%`, top: `${it.y}%`, width: `${FURNITURE[it.id].w}%`, transform: "translate(-50%, -50%)" }}
            onPointerDown={(e) => onItemDown(e, i)}
          >
            <FurnitureArt id={it.id} className="block h-auto w-full" />
            {editing && selected === i && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setItems((list) => list.filter((_, j) => j !== i));
                  setSelected(null);
                }}
                className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                aria-label={`${FURNITURE[it.id].label}をしまう`}
              >
                ×
              </button>
            )}
          </div>
        ))}

        <div
          ref={mochiRef}
          className={`absolute left-0 top-0 ${editing ? "pointer-events-none opacity-60" : "cursor-grab active:cursor-grabbing"}`}
          style={{ width: SIZE, height: SIZE, willChange: "transform" } as CSSProperties}
          onPointerDown={onMochiDown}
          role="img"
          aria-label={`${displayName}のもち（タップ・ドラッグで遊べます）`}
        >
          <div key={squish} className={squish > 0 ? "mochi-squish" : undefined} style={{ transformOrigin: "50% 100%" }}>
            <Mochi avatar={avatar} size={SIZE} seed={seed} />
          </div>
        </div>
      </div>
      {!editing && <p className="text-xs text-ink-soft">もちをタップするとつぶれて、ドラッグすると伸びながら動きます。勢いよく投げると部屋中を跳ねまわります。</p>}

      {editing && (
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-paper p-4 shadow-sm">
          <div>
            <h2 className="mb-2 text-sm font-bold">壁紙</h2>
            <div className="flex flex-wrap gap-2">
              {wallpaperList.map((id) =>
                ownsWallpaper(id, ownedSet) ? (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setWallpaper(id)}
                    aria-pressed={wallpaper === id}
                    className={`flex items-center gap-2 rounded-full border-2 px-3 py-1 text-xs ${wallpaper === id ? "border-accent font-bold" : "border-transparent bg-cream"}`}
                  >
                    <span className="h-4 w-4 rounded-full border border-line" style={{ background: WALLPAPERS[id].bg }} aria-hidden />
                    {WALLPAPERS[id].label}
                  </button>
                ) : (
                  <Link key={id} href="/shop?kind=wallpaper" className="flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs text-ink-soft opacity-70 hover:opacity-100">
                    🔒 {WALLPAPERS[id].label}
                  </Link>
                ),
              )}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-bold">
              家具を置く <span className="font-normal text-ink-soft">（{items.length} / {MAX_ROOM_ITEMS}・置いた家具はドラッグで動かせます）</span>
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {furnitureList.map((id) =>
                ownsFurniture(id, ownedSet) ? (
                  <button
                    key={id}
                    type="button"
                    onClick={() => addItem(id)}
                    disabled={items.length >= MAX_ROOM_ITEMS}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-cream p-2 text-xs hover:bg-sakura/20 disabled:opacity-40"
                  >
                    <span className="flex h-10 w-14 items-center justify-center">
                      <FurnitureArt id={id} className="max-h-10 w-full" />
                    </span>
                    ＋ {FURNITURE[id].label}
                  </button>
                ) : (
                  <Link key={id} href="/shop?kind=furniture" className="flex flex-col items-center gap-1 rounded-2xl bg-cream p-2 text-xs text-ink-soft opacity-60 hover:opacity-100">
                    <span className="flex h-10 w-14 items-center justify-center grayscale">
                      <FurnitureArt id={id} className="max-h-10 w-full" />
                    </span>
                    🔒 {FURNITURE[id].label}
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * もちの箱の中の位置（px）を、Mochi の viewBox の中の位置に直して、どこをどれだけ引っぱったかを出す。
 * キングもちは 1.7 倍、2段・3段もちは縮めて積んでいるので、そのぶん戻す
 */
function toBody(gx: number, gy: number, pullX: number, pullY: number, s: number, form: Avatar["form"] = "round"): { copy: number; bulge: Bulge } {
  let u = (gx / s) * 100;
  let v = (gy / s) * 100;
  let k = 100 / s;
  let copy = 0;
  if (form === "king") {
    u = 50 + (u - 50) / 1.7;
    v = 92 + (v - 92) / 1.7;
    k /= 1.7;
  }
  const n = FORM_STACK[form] + 1;
  if (n > 1) {
    const sc = 88 / (56 + (n - 1) * FORM_STACK_STEP);
    u = (u - 50) / sc + 50;
    v = (v - 90) / sc + 90;
    k /= sc;
    copy = Math.min(n - 1, Math.max(0, Math.floor((90 - v) / FORM_STACK_STEP)));
    v += copy * FORM_STACK_STEP;
  }
  let dx = pullX * k;
  let dy = pullY * k;
  const len = Math.hypot(dx, dy);
  const max = 70;
  if (len > max) {
    dx *= max / len;
    dy *= max / len;
  }
  return { copy, bulge: { angle: outlineAngle(u, v), dx, dy } };
}
