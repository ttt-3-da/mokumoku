"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DeskItem, Mochi, type MochiState } from "@/components/mochi";
import { Button, Card } from "@/components/ui";
import {
  CHEEKS,
  COLORS,
  DESK_ITEMS,
  EYES,
  HACHIMAKI,
  HEAD_ITEMS,
  isItemAvailable,
  itemId,
  MOUTHS,
  UNLOCKABLE_ITEMS,
  type Avatar,
} from "@/lib/avatar";
import { saveAvatar } from "./actions";

type PartKey = keyof Avatar;

const SECTIONS: { key: PartKey; title: string; options: Record<string, string> }[] = [
  { key: "color", title: "体の色", options: Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v.label])) },
  { key: "eyes", title: "目", options: EYES },
  { key: "mouth", title: "口", options: MOUTHS },
  { key: "cheeks", title: "ほっぺ", options: CHEEKS },
  { key: "head", title: "頭の小物", options: HEAD_ITEMS },
  { key: "desk", title: "机の小物", options: DESK_ITEMS },
  { key: "hachimaki", title: "ハチマキ（集中中）", options: HACHIMAKI },
];

const PREVIEW_STATES: { state: MochiState; label: string }[] = [
  { state: "idle", label: "ふつう" },
  { state: "focus", label: "集中中" },
  { state: "break", label: "休憩中" },
  { state: "away", label: "離席中" },
];

export function AvatarEditor({
  initial,
  unlocked,
  seed,
  username,
}: {
  initial: Avatar;
  unlocked: string[];
  seed: string;
  username: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [avatar, setAvatar] = useState(initial);
  const [previewState, setPreviewState] = useState<MochiState>("idle");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);
  const dirty = (Object.keys(avatar) as PartKey[]).some((k) => avatar[k] !== saved[k]);

  function choose(key: PartKey, value: string) {
    setAvatar((a) => ({ ...a, [key]: value }));
    setMessage(null);
    // ハチマキは集中中にしか見えないので、選んだらプレビューを集中中にする
    if (key === "hachimaki") setPreviewState("focus");
  }

  function save() {
    startTransition(async () => {
      const res = await saveAvatar(avatar);
      if (res.error || !res.avatar) {
        setMessage({ ok: false, text: res.error ?? "保存できませんでした" });
        return;
      }
      setSaved(res.avatar);
      setAvatar(res.avatar);
      setMessage({ ok: true, text: "保存しました！" });
    });
  }

  return (
    <div className="grid gap-5 md:grid-cols-[280px_1fr] md:items-start">
      <Card className="flex flex-col items-center gap-4 md:sticky md:top-20">
        <div className="flex items-end gap-1 pt-4">
          <Mochi avatar={avatar} size={150} state={previewState} seed={seed} label="プレビュー" />
          <DeskItem kind={avatar.desk} size={44} level={3} />
        </div>
        <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="プレビューの状態">
          {PREVIEW_STATES.map((s) => (
            <button
              key={s.state}
              type="button"
              onClick={() => setPreviewState(s.state)}
              aria-pressed={previewState === s.state}
              className={`rounded-full px-3 py-1 text-xs ${
                previewState === s.state ? "bg-ink text-paper" : "bg-cream hover:bg-sakura/20"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={save} disabled={!dirty || pending}>
            {pending ? "保存中…" : "この見た目にする"}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setAvatar(saved)} disabled={pending}>
              元に戻す
            </Button>
          )}
          {message && (
            <p role={message.ok ? "status" : "alert"} className={`text-center text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
          <Link href={`/u/${username}`} className="text-center text-xs text-ink-soft hover:underline">
            プロフィールに戻る
          </Link>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <Card key={section.key}>
            <h2 className="mb-3 text-sm font-bold">{section.title}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {Object.entries(section.options).map(([value, label]) => {
                const id =
                  section.key === "head" || section.key === "desk" || section.key === "hachimaki"
                    ? itemId(section.key, value)
                    : "";
                const available = isItemAvailable(id, unlockedSet);
                const condition = UNLOCKABLE_ITEMS[id as keyof typeof UNLOCKABLE_ITEMS];
                const selected = avatar[section.key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!available}
                    onClick={() => choose(section.key, value)}
                    aria-pressed={selected}
                    title={available ? label : `${label}（${condition}で解放）`}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs transition ${
                      selected ? "border-accent bg-sakura/10" : "border-transparent bg-cream hover:border-line"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <OptionPreview section={section.key} value={value} base={avatar} />
                    <span className="leading-tight">{label}</span>
                    {!available && <span className="text-[10px] text-ink-soft">🔒 {condition}</span>}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OptionPreview({ section, value, base }: { section: PartKey; value: string; base: Avatar }) {
  if (section === "desk") {
    return value === "none" ? (
      <span className="flex h-12 items-center text-lg text-ink-soft">—</span>
    ) : (
      <DeskItem kind={value as Avatar["desk"]} size={48} level={3} />
    );
  }
  const preview = { ...base, [section]: value } as Avatar;
  // 静止したプレビュー（たくさん並ぶので動かさない）
  return (
    <span className="anim-paused">
      <Mochi avatar={preview} size={48} state={section === "hachimaki" ? "focus" : "idle"} seed={`option-${value}`} />
    </span>
  );
}
