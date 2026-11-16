"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { FurnitureArt } from "@/components/furniture-art";
import { Mochi } from "@/components/mochi";
import { PlacedStamps, StampPalette, type RoomStamp } from "@/components/mochi-room-stamps";
import { FORM_STACK, FORM_STACK_STEP, type Avatar } from "@/lib/avatar";
import { bodyOutline, faceStretch, outlineAngle, outlineNormal, type Bulge } from "@/lib/mochi-body";
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
import { usableStamps, type StampId } from "@/lib/stamps";
import { createClient } from "@/lib/supabase/client";

type Props = {
  avatar: Avatar;
  seed: string;
  username: string;
  displayName: string;
  isMe: boolean;
  wallpaper: WallpaperId;
  items: PlacedItem[];
  owned: string[];
  /** 遊びに来た人が置いていったスタンプ */
  stamps: RoomStamp[];
  /** 見ている人（スタンプを置く） */
  visitor: { avatar: Avatar; isPublic: boolean };
};

/**
 * もちの部屋。もちをタップするとつぶれる、ドラッグすると伸びながらついてくる、
 * 勢いよく離すと部屋の中を跳ねまわる。自分の部屋なら壁紙と家具を模様がえできる
 */
export function MochiRoom({ avatar, seed, username, displayName, isMe, wallpaper: initialWallpaper, items: initialItems, owned, stamps: initialStamps, visitor }: Props) {
  const ownedSet = new Set(owned);
  const myStamps = usableStamps(owned);
  const [stamps, setStamps] = useState(initialStamps);
  const [stampBusy, setStampBusy] = useState(false);
  const [stampMessage, setStampMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // 遊びに来た人：スタンプを部屋のどこかに置いていく
  async function leaveStamp(id: StampId) {
    setStampBusy(true);
    setStampMessage(null);
    const x = Math.round((10 + Math.random() * 80) * 10) / 10;
    const y = Math.round((12 + Math.random() * 60) * 10) / 10;
    const { data, error } = await createClient().rpc("leave_mochi_stamp", { p_username: username, p_stamp_id: id, p_x: x, p_y: y });
    setStampBusy(false);
    if (error || !data) {
      setStampMessage({ ok: false, text: rpcErrorMessage(error) });
      return;
    }
    setStamps((list) => [
      ...list,
      { id: data as string, stamp_id: id, x, y, created_at: new Date().toISOString(), mine: true, sender_username: "", sender_display_name: "あなた", sender_avatar: visitor.avatar },
    ]);
    setStampMessage({ ok: true, text: "スタンプを置きました！" });
  }

  async function removeStamp(st: RoomStamp) {
    const { error } = await createClient().rpc("remove_mochi_stamp", { p_id: st.id });
    if (error) {
      setStampMessage({ ok: false, text: rpcErrorMessage(error) });
      return;
    }
    setStamps((list) => list.filter((x) => x.id !== st.id));
  }
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
  const grab = useRef({ ox: 0, oy: 0, lastX: 0, lastY: 0, lastT: 0, startX: 0, startY: 0, moved: false, vx: 0, vy: 0, fx: 0, fy: 0 });
  const raf = useRef<number | null>(null);

  // もちもちのスクイーズ：押すとむにっと横に広がってつぶれ、離すとぽよんと弾んで元に戻る
  const squeezeRef = useRef<HTMLDivElement>(null);
  const squeeze = useRef({ v: 0, vel: 0, holding: false, side: "bottom" as "bottom" | "top" | "left" | "right" });
  // つまんだところの出っ張り（viewBox の単位）。ばねで出たり戻ったりする
  const pinch = useRef({ copy: 0, angle: 0, nx: 0, ny: 0, k: 1, x: 0, y: 0, vx: 0, vy: 0 });
  const form = avatar.form ?? "round";
  const squeezeRaf = useRef<number | null>(null);

  const runSqueeze = useCallback(() => {
    if (squeezeRaf.current) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const q = squeeze.current;
      // ばねで動かす：押すとむにーっとつぶれ、離すと少し伸び上がってから、ぽよんぽよんと落ち着く
      // つまんで動かしているときは、体はつぶさない（出っ張りだけ）
      const target = q.holding ? (mode.current === "drag" && grab.current.moved ? 0 : 0.64) : 0;
      const k = q.holding ? 70 : 160; // 押すときはやわらかく、戻るときは弾むように
      const c = q.holding ? 14 : 9;
      q.vel += (-k * (q.v - target) - c * q.vel) * dt;
      q.v = Math.max(-0.35, Math.min(1, q.v + q.vel * dt));
      // つまんで動かしているあいだは、つまんだところが指の向きへむにっと出っ張る
      const pc = pinch.current;
      const pinching = q.holding && mode.current === "drag" && grab.current.moved;
      let tx = 0;
      let ty = 0;
      if (pinching) {
        const g = grab.current;
        const b = body.current;
        // つまんだところから指までのずれ（px）を viewBox の単位にして、そのぶん伸ばす
        tx = pc.nx * 4 + (g.fx - (b.x + g.ox)) * pc.k;
        ty = pc.ny * 4 + (g.fy - (b.y + g.oy)) * pc.k;
      }
      const pk = pinching ? 90 : 170;
      const pd = pinching ? 16 : 10;
      pc.vx += (-pk * (pc.x - tx) - pd * pc.vx) * dt;
      pc.vy += (-pk * (pc.y - ty) - pd * pc.vy) * dt;
      pc.x += pc.vx * dt;
      pc.y += pc.vy * dt;
      const bulging = pinching || Math.hypot(pc.x, pc.y) > 0.05 || Math.hypot(pc.vx, pc.vy) > 0.5;
      if (!bulging) {
        pc.x = pc.y = pc.vx = pc.vy = 0;
      }
      const square = form === "square";
      squeezeRef.current?.querySelectorAll<SVGPathElement>("[data-mochi-body]").forEach((path) => {
        const b: Bulge | null = bulging && Number(path.dataset.mochiBody) === pc.copy ? { angle: pc.angle, dx: pc.x, dy: pc.y } : null;
        path.setAttribute("d", bodyOutline(square, b));
      });
      // 顔やアクセサリーも、つまんだ段だけいっしょに動く
      squeezeRef.current?.querySelectorAll<SVGGElement>("[data-mochi-face]").forEach((g) => {
        const on = bulging && Number(g.dataset.mochiFace) === pc.copy;
        const tf = on ? faceStretch({ angle: pc.angle, dx: pc.x, dy: pc.y }) : "";
        if (tf) g.setAttribute("transform", tf);
        else g.removeAttribute("transform");
      });
      if (!q.holding && !bulging && Math.abs(q.v) < 0.003 && Math.abs(q.vel) < 0.02) {
        q.v = 0;
        q.vel = 0;
      }
      // 高さが縮んだぶん、横にふくらむ（もちの量は変わらない）
      const sy = 1 - q.v * 0.48;
      const sx = 1 / Math.sqrt(sy);
      const el = squeezeRef.current;
      // ぶつかった面に向かってつぶれる（床・天井はたて、壁はよこ）
      if (el) {
        const across = q.side === "left" || q.side === "right";
        el.style.transformOrigin = { bottom: "50% 100%", top: "50% 0%", left: "0% 50%", right: "100% 50%" }[q.side];
        el.style.transform = q.v ? (across ? `scale(${sy.toFixed(4)}, ${sx.toFixed(4)})` : `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`) : "";
      }
      if (q.v === 0 && q.vel === 0 && !q.holding && !bulging) {
        squeezeRaf.current = null;
        return;
      }
      squeezeRaf.current = requestAnimationFrame(tick);
    };
    squeezeRaf.current = requestAnimationFrame(tick);
  }, [form]);

  useEffect(
    () => () => {
      if (squeezeRaf.current) cancelAnimationFrame(squeezeRaf.current);
    },
    [],
  );

  // もちの形は変えずに、位置だけ動かす
  const paint = useCallback(() => {
    const el = mochiRef.current;
    if (!el) return;
    el.style.transform = `translate(${body.current.x}px, ${body.current.y}px)`;
  }, []);

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

  // 投げたあと：壁や床で跳ね返りながら、床で止まる
  const fly = useCallback(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const { w, h } = roomSize();
      const s = sizeRef.current;
      const prev = body.current;
      const next = stepBounce(prev, dt, w, h, s);
      body.current = { x: next.x, y: next.y, vx: next.vx, vy: next.vy };
      if (next.hit) {
        // 床・壁・天井にぶつかったら、その勢いのぶんだけむにゅっとつぶれて、ぽよんと戻る
        const hits: ["bottom" | "top" | "left" | "right", number][] = [];
        if (next.y >= h - s - 0.5 && prev.vy > 0) hits.push(["bottom", prev.vy]);
        if (next.y <= 0.5 && prev.vy < 0) hits.push(["top", -prev.vy]);
        if (next.x <= 0.5 && prev.vx < 0) hits.push(["left", -prev.vx]);
        if (next.x >= w - s - 0.5 && prev.vx > 0) hits.push(["right", prev.vx]);
        const [side, speed] = hits.sort((a, b) => b[1] - a[1])[0] ?? ["bottom", 0];
        if (speed > 90) {
          const q = squeeze.current;
          // つぶれている途中で向きを変えると形が飛ぶので、ほぼ戻ってから切りかえる
          if (Math.abs(q.v) < 0.15) q.side = side;
          q.vel += Math.min(26, speed / 75);
          runSqueeze();
        }
      }
      paint();
      const resting = next.y >= h - s - 0.5 && Math.abs(next.vx) < 8 && next.vy === 0;
      if (mode.current === "fly" && !resting) {
        raf.current = requestAnimationFrame(tick);
      } else {
        mode.current = "rest";
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, [paint, roomSize, runSqueeze]);

  function onMochiDown(e: ReactPointerEvent) {
    if (editing || !roomRef.current) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (raf.current) cancelAnimationFrame(raf.current);
    const r = roomRef.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    mode.current = "drag";
    grab.current = { ox: px - body.current.x, oy: py - body.current.y, lastX: px, lastY: py, lastT: performance.now(), startX: px, startY: py, moved: false, vx: 0, vy: 0, fx: px, fy: py };
    body.current.vx = 0;
    body.current.vy = 0;
    squeeze.current.holding = true;
    squeeze.current.side = "bottom";
    pinch.current = { ...pinch.current, ...pinchPoint(px - body.current.x, py - body.current.y, sizeRef.current, form) };
    runSqueeze();
  }

  // ドラッグ：もちは指についてくる
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
    // 引っぱると、つまんだところが指まで伸びる。伸びきったら体ごとついてくる
    const s = sizeRef.current;
    const b = body.current;
    const dx = px - (b.x + g.ox);
    const dy = py - (b.y + g.oy);
    const d = Math.hypot(dx, dy);
    const max = s * STRETCH_MAX;
    if (d > max) {
      b.x += dx * (1 - max / d);
      b.y += dy * (1 - max / d);
    }
    b.x = Math.min(r.width - s, Math.max(0, b.x));
    b.y = Math.min(r.height - s, Math.max(0, b.y));
    g.fx = px;
    g.fy = py;
    paint();
  }

  function onMochiUp() {
    if (mode.current !== "drag") return;
    const g = grab.current;
    const b = body.current;
    squeeze.current.holding = false;
    if (!g.moved) {
      // タップ：短く押しても、むにっとつぶれてからぽよんと戻る
      b.vx = 0;
      b.vy = 0;
      squeeze.current.vel = Math.max(squeeze.current.vel, 7);
      runSqueeze();
    } else {
      // 勢いよく投げると、そのまま飛んでいく。ゆっくり離すと、その場から落ちる
      const keep = Math.hypot(g.vx, g.vy) < 400 ? 0.3 : 1;
      b.vx = g.vx * keep + (g.fx - (b.x + g.ox)) * 4;
      b.vy = g.vy * keep + (g.fy - (b.y + g.oy)) * 4;
    }
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

        {!editing && <PlacedStamps stamps={stamps} canRemoveAll={isMe} onRemove={(st) => void removeStamp(st)} />}

        <div
          ref={mochiRef}
          className={`absolute left-0 top-0 ${editing ? "pointer-events-none opacity-60" : "cursor-grab active:cursor-grabbing"}`}
          style={{ width: SIZE, height: SIZE, willChange: "transform" } as CSSProperties}
          onPointerDown={onMochiDown}
          role="img"
          aria-label={`${displayName}のもち（タップ・ドラッグで遊べます）`}
        >
          <div ref={squeezeRef} style={{ transformOrigin: "50% 100%" }}>
            <Mochi avatar={avatar} size={SIZE} seed={seed} />
          </div>
        </div>
      </div>
      {!editing && <p className="text-xs text-ink-soft">もちを押すとむにっとつぶれて、離すとぽよんと戻ります。ドラッグで動かせて、勢いよく投げると部屋中を跳ねまわります。</p>}

      {!isMe && (
        <div className="flex flex-col gap-2 rounded-3xl border border-line bg-paper p-4 shadow-sm">
          <h2 className="text-sm font-bold">スタンプを置いていく</h2>
          {visitor.isPublic ? (
            <StampPalette stamps={myStamps} avatar={visitor.avatar} disabled={stampBusy} onPick={(id) => void leaveStamp(id)} />
          ) : (
            <p className="text-xs text-ink-soft">プロフィールを公開すると、スタンプを置けます（設定の「公開範囲」）。</p>
          )}
          {stampMessage && (
            <p role={stampMessage.ok ? "status" : "alert"} className={`text-xs ${stampMessage.ok ? "text-green-700" : "text-red-600"}`}>
              {stampMessage.text}
            </p>
          )}
        </div>
      )}
      {isMe && !editing && stamps.length > 0 && <p className="text-xs text-ink-soft">遊びに来た人が置いていったスタンプ：{stamps.length}個（押すとだれのスタンプかわかります）</p>}

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

/** 引っぱって伸びる長さの上限（もちの大きさに対して） */
const STRETCH_MAX = 0.45;

/**
 * もちの箱の中でつまんだ位置（px）を、Mochi の viewBox の中に直して、輪郭のどこか・何段目かを出す。
 * キングもちは 1.7 倍、2段・3段もちは縮めて積んでいるので、そのぶん戻す。k は 1px が viewBox でいくつか
 */
function pinchPoint(gx: number, gy: number, s: number, form: NonNullable<Avatar["form"]>) {
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
  const angle = outlineAngle(u, v);
  const [nx, ny] = outlineNormal(angle);
  return { copy, angle, nx, ny, k };
}
