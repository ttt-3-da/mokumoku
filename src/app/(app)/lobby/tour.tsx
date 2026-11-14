"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mochi } from "@/components/mochi";
import type { Avatar } from "@/lib/avatar";

type Step = {
  /** 指す場所（data-tour の値）。前から順に、画面に見えている最初のものを使う。なければ真ん中に出す */
  targets?: string[];
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "ようこそ、Mokumoku へ！",
    body: "みんなで静かに勉強する、オンラインの自習室です。使い方をかんたんに案内しますね。",
  },
  {
    targets: ["rooms"],
    title: "部屋に入って勉強しよう",
    body: "部屋を選んで入室すると、ポモドーロのタイマーでみんなと一緒に集中できます。退室すると記録が残ります。",
  },
  {
    targets: ["create-room"],
    title: "自分の部屋もつくれます",
    body: "部屋の設定で曜日と時刻を決めると「定例の部屋」になり、時間になるとタイマーが自動で始まります。",
  },
  {
    targets: ["goal"],
    title: "週の目標を決めよう",
    body: "1週間に勉強する時間を決めると、ここに進み具合が出ます。達成すると🪙20もらえます。",
  },
  {
    targets: ["coins"],
    title: "コインでもちを着せかえ",
    body: "勉強するとコインがたまります。ショップで色や小物、部屋のテーマを買って、プロフィールの「もちを着せかえる」から身につけられます。",
  },
  {
    targets: ["nav-timeline", "menu"],
    title: "記録とバッジ",
    body: "メニューの「記録」では勉強した時間をグラフでふり返れます。「プロフィール」には集めた実績バッジが並びます。",
  },
  {
    targets: ["nav-users", "menu"],
    title: "仲間をフォロー",
    body: "メニューの「さがす」で人を見つけてフォローすると、その人がいま勉強中かがロビーに出ます。",
  },
  {
    title: "準備はばっちり！",
    body: "この案内は「設定」からいつでも見直せます。さっそく部屋に入ってみましょう。",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const BUBBLE_W = 320;

function findTarget(targets: string[] | undefined): HTMLElement | null {
  for (const t of targets ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

/** 新規登録の直後（/lobby?tour=1）に、本物の画面の上でもちが順に指して案内する */
export function Tour({ open: initialOpen, avatar }: { open: boolean; avatar: Avatar }) {
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // 再読み込みでまた出ないように、URL から ?tour=1 を外す
  useEffect(() => {
    if (!initialOpen) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    window.history.replaceState(window.history.state, "", url);
  }, [initialOpen]);

  const measure = useCallback(() => {
    const el = findTarget(STEPS[step].targets);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = findTarget(STEPS[step].targets);
    el?.scrollIntoView({ block: "center", behavior: "instant" });
    const timer = setTimeout(measure, 0);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") setStep((v) => Math.min(v + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setStep((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  if (!open) return null;

  // 吹き出しは、指す場所の下（入らなければ上）に置く。指す場所がなければ真ん中
  let bubbleStyle: React.CSSProperties;
  if (rect && typeof window !== "undefined") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(BUBBLE_W, vw - 32);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), vw - width - 16);
    const below = rect.top + rect.height + 12;
    bubbleStyle = below + 260 < vh ? { top: below, left, width } : { bottom: Math.max(16, vh - rect.top + 12), left, width };
  } else {
    bubbleStyle = { top: "50%", left: "50%", width: `min(${BUBBLE_W + 40}px, calc(100vw - 32px))`, transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* 暗い幕。指す場所だけ穴をあけて照らす */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-sakura transition-all duration-200"
          style={{ ...rect, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
          aria-hidden
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" aria-hidden />
      )}
      {/* 後ろの画面は押せないようにする */}
      <div className="fixed inset-0" aria-hidden />

      <div className="fixed flex flex-col gap-3 rounded-3xl bg-paper p-4 shadow-xl" style={bubbleStyle}>
        <div className="flex items-start gap-3">
          <Mochi avatar={avatar} size={rect ? 56 : 72} seed="tour" hop={step === 0} celebrate={last} className="shrink-0" />
          <div className="min-w-0">
            <h2 id="tour-title" className="font-bold">
              {rect && <span aria-hidden>👉 </span>}
              {s.title}
            </h2>
            <p id="tour-body" className="mt-1 text-sm leading-relaxed text-ink-soft">
              {s.body}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-ink-soft" aria-label={`${STEPS.length}枚中${step + 1}枚目`}>
            {step + 1} / {STEPS.length}
          </span>
          {!last && (
            <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-cream">
              とばす
            </button>
          )}
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={`rounded-full border border-line px-3 py-1.5 text-sm hover:bg-cream ${last ? "ml-auto" : ""}`}
            >
              もどる
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={() => (last ? setOpen(false) : setStep(step + 1))}
            className={`rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white hover:bg-accent-strong`}
          >
            {last ? "はじめる" : "つぎへ"}
          </button>
        </div>
      </div>
    </div>
  );
}
