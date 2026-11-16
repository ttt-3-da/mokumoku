"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { EmoteGlyph } from "@/components/emote-marks";
import { DeskItem, Mochi } from "@/components/mochi";
import { StampArt } from "@/components/stamp-art";
import { FurnitureArt } from "@/components/furniture-art";
import { FURNITURE, isFurniture, isWallpaper, WALLPAPERS, type FurnitureId, type WallpaperId } from "@/lib/mochi-room";
import { Button, Card } from "@/components/ui";
import { FORMS, parseShopItem, type Avatar, type AvatarForm, type ShopPart } from "@/lib/avatar";
import { rpcErrorMessage } from "@/lib/errors";
import { EMOTES, getEmote, type EmoteId } from "@/lib/emotes";
import { coinsShort, formatCoins, parseShopSort, SHOP_SORTS, sortShopItems, type ShopKind, type ShopSort } from "@/lib/shop";
import { getStamp, STAMPS, type StampId } from "@/lib/stamps";
import { playSound, useMuted } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import type { ShopItem, Wallet } from "@/lib/supabase/server";
import { saveAvatar } from "../avatar/actions";


/** 品物の名前と絵の種類。知らない品物は null（一覧に出さない） */
function describe(itemId: string):
  | { type: "part"; part: ShopPart; value: string; label: string }
  | { type: "stamp"; id: StampId; label: string }
  | { type: "emote"; id: EmoteId; label: string }
  | { type: "wallpaper"; id: WallpaperId; label: string }
  | { type: "furniture"; id: FurnitureId; label: string }
  | { type: "form"; id: AvatarForm; label: string }
  | null {
  const [k, v] = itemId.split(":");
  if (k === "wallpaper") return isWallpaper(v) ? { type: "wallpaper", id: v, label: WALLPAPERS[v].label } : null;
  if (k === "furniture") return isFurniture(v) ? { type: "furniture", id: v, label: FURNITURE[v].label } : null;
  if (k === "form") return Object.hasOwn(FORMS, v) ? { type: "form", id: v as AvatarForm, label: FORMS[v as AvatarForm] } : null;
  if (k === "stamp") {
    const st = getStamp(v);
    return st ? { type: "stamp", id: st.id, label: st.label } : null;
  }
  if (k === "emote") {
    const e = getEmote(v);
    return e ? { type: "emote", id: e.id, label: e.label } : null;
  }
  const part = parseShopItem(itemId);
  return part ? { type: "part", ...part } : null;
}

const freeNames = (list: readonly { label: string; free?: boolean }[]) =>
  list
    .filter((x) => x.free)
    .map((x) => x.label)
    .join("・");

/** 種類のタブ */
const CATEGORIES: { kind: ShopKind; label: string; free: string; ready: boolean }[] = [
  { kind: "color", label: "体の色", free: "白もち・さくら・よもぎ", ready: true },
  { kind: "eyes", label: "目", free: "点・にっこり・キラキラ・ねむそう・メガネ付き", ready: true },
  { kind: "mouth", label: "口", free: "ω・小さな丸・にっこり・への字", ready: true },
  { kind: "cheeks", label: "ほっぺ", free: "なし・ピンク・オレンジ", ready: true },
  { kind: "head", label: "頭の小物", free: "なし・リボン", ready: true },
  { kind: "neck", label: "首の小物", free: "なし", ready: true },
  { kind: "desk", label: "机の小物", free: "なし", ready: true },
  { kind: "form", label: "フォルム", free: "まる", ready: true },
  { kind: "stamp", label: "スタンプ", free: freeNames(STAMPS), ready: true },
  { kind: "emote", label: "エモート", free: freeNames(EMOTES), ready: true },
  { kind: "wallpaper", label: "部屋の壁紙", free: "クリーム・さくら", ready: true },
  { kind: "furniture", label: "部屋の家具", free: "観葉植物・ラグ・スタンドライト", ready: true },
];

const SORT_KEY = "mokumoku:shop-sort";

export function ShopView({
  seed,
  avatar,
  wallet: initialWallet,
  items,
  initialKind = "color",
}: {
  seed: string;
  avatar: Avatar;
  wallet: Wallet;
  items: ShopItem[];
  initialKind?: ShopKind;
}) {
  const router = useRouter();
  const [wallet, setWallet] = useState(initialWallet);
  const [wearing, setWearing] = useState(avatar);
  const [kind, setKind] = useState<ShopKind>(initialKind);
  // エモートの試しを繰り返し見せるための番号
  const [replay, setReplay] = useState(0);
  // 買えたときに、もちがぴょんと跳ねる
  const [cheer, setCheer] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<ShopSort>("recommended");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [muted] = useMuted();

  // 並び順はこのブラウザに覚えておく
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setSort(parseShopSort(localStorage.getItem(SORT_KEY)));
      } catch {
        // 保存できない環境ではおすすめ順のまま
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const owned = useMemo(() => new Set(wallet.owned), [wallet.owned]);
  const shown = useMemo(
    () =>
      sortShopItems(
        items.filter((i) => i.kind === kind && describe(i.item_id) !== null),
        owned,
        sort,
      ),
    [items, kind, owned, sort],
  );
  const selectedItem = shown.find((i) => i.item_id === selected) ?? null;
  const selectedInfo = selectedItem ? describe(selectedItem.item_id) : null;
  const selectedPart = selectedInfo?.type === "part" ? selectedInfo : null;
  const withPart = (a: Avatar, part: ShopPart, value: string) => ({ ...a, [part]: value }) as Avatar;
  const preview = selectedPart ? withPart(wearing, selectedPart.part, selectedPart.value) : wearing;
  const selectedType = selectedInfo?.type;

  // エモートを選んでいる間は、3秒ごとに動きをくり返す
  useEffect(() => {
    if (selectedType !== "emote") return;
    const id = setInterval(() => setReplay((n) => n + 1), 3200);
    return () => clearInterval(id);
  }, [selectedType, selected]);
  const category = CATEGORIES.find((c) => c.kind === kind)!;

  function changeSort(v: ShopSort) {
    setSort(v);
    try {
      localStorage.setItem(SORT_KEY, v);
    } catch {
      // 保存できなくても並び替えはできる
    }
  }

  function changeKind(k: ShopKind) {
    setKind(k);
    setSelected(null);
    setMessage(null);
  }

  function buy() {
    if (!selectedItem || !selectedInfo) return;
    if (!window.confirm(`「${selectedInfo.label}」を 🪙${selectedItem.price} で買いますか？（返品はできません）`)) return;
    setMessage(null);
    startTransition(async () => {
      const { data, error } = await createClient().rpc("buy_item", { p_item_id: selectedItem.item_id });
      if (error) {
        setMessage({ ok: false, text: rpcErrorMessage(error) });
        return;
      }
      setWallet((w) => ({ coins: typeof data === "number" ? data : w.coins - selectedItem.price, owned: [...w.owned, selectedItem.item_id] }));
      setCheer((n) => n + 1);
      if (!muted) playSound("cheer");
      setMessage({
        ok: true,
        text: selectedInfo.type === "part" ? `「${selectedInfo.label}」を買いました！` : `「${selectedInfo.label}」を買いました！部屋で使えます`,
      });
      router.refresh(); // ヘッダーのコインを更新
    });
  }

  function changeForm(form: AvatarForm) {
    setMessage(null);
    startTransition(async () => {
      const { error } = await createClient().rpc("set_avatar_form", { p_form: form });
      if (error) {
        setMessage({ ok: false, text: rpcErrorMessage(error) });
        return;
      }
      setWearing((w) => ({ ...w, form }));
      setMessage({ ok: true, text: `「${FORMS[form]}」になりました！` });
    });
  }

  function wear() {
    if (!selectedPart) return;
    setMessage(null);
    startTransition(async () => {
      const res = await saveAvatar(withPart(wearing, selectedPart.part, selectedPart.value));
      if (res.error || !res.avatar) {
        setMessage({ ok: false, text: res.error ?? "着がえられませんでした" });
        return;
      }
      setWearing(res.avatar);
      setMessage({ ok: true, text: "着がえました！" });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">ショップ</h1>
        <span className="rounded-full bg-paper px-3 py-1 text-sm font-bold tabular-nums shadow-sm" aria-label={`所持コイン ${formatCoins(wallet.coins)}枚`}>
          🪙 {formatCoins(wallet.coins)}
        </span>
        <Link href="/coins" className="text-sm text-ink-soft hover:underline">
          コインの履歴・もらい方
        </Link>
        <Link href="/avatar" className="ml-auto text-sm text-ink-soft hover:underline">
          着せかえへ →
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_1fr] md:items-start">
        {/* 試着 */}
        <Card className="flex flex-col items-center gap-3 md:sticky md:top-20">
          {selectedInfo?.type === "wallpaper" ? (
            <div className="flex h-36 w-full items-end justify-center rounded-2xl border border-line" style={{ background: WALLPAPERS[selectedInfo.id].bg }}>
              <Mochi avatar={wearing} size={80} seed={seed} />
            </div>
          ) : selectedInfo?.type === "furniture" ? (
            <div className="flex h-36 w-full items-center justify-center">
              <FurnitureArt id={selectedInfo.id} className="max-h-32 w-3/4" />
            </div>
          ) : selectedInfo?.type === "form" ? (
            <div className="flex h-40 items-end pb-2">
              <Mochi key={`form-${cheer}`} avatar={{ ...wearing, form: selectedInfo.id }} size={selectedInfo.id === "king" ? 80 : 120} seed={seed} celebrate={cheer > 0} label={`${selectedInfo.label}のもち`} />
            </div>
          ) : selectedInfo?.type === "stamp" ? (
            <StampArt key={selectedInfo.id} id={selectedInfo.id} avatar={wearing} size={140} className="animate-mochi-drop" />
          ) : selectedInfo?.type === "emote" ? (
            <Mochi
              key={`${selectedInfo.id}-${replay}`}
              avatar={wearing}
              size={140}
              seed={seed}
              emote={selectedInfo.id}
              label={`${selectedInfo.label}のエモート`}
            />
          ) : (
            <div className="flex items-end">
              <Mochi key={`cheer-${cheer}`} avatar={preview} size={140} seed={seed} celebrate={cheer > 0} label="試着中のもち" />
              <DeskItem kind={preview.desk} size={44} level={3} />
            </div>
          )}
          {selectedItem && selectedInfo ? (
            <>
              <p className="text-center font-bold">{selectedInfo.label}</p>
              {owned.has(selectedItem.item_id) ? (
                selectedInfo.type === "form" ? (
                  (wearing.form ?? "round") === selectedInfo.id ? (
                    <p className="text-sm text-ink-soft">この形です</p>
                  ) : (
                    <Button onClick={() => changeForm(selectedInfo.id)} disabled={pending} className="w-full">
                      {pending ? "変えています…" : "この形にする"}
                    </Button>
                  )
                ) : selectedInfo.type === "wallpaper" || selectedInfo.type === "furniture" ? (
                  <Link href="/mochi" className="text-sm font-bold text-accent-strong underline">
                    持っています（もちの部屋で使う）
                  </Link>
                ) : !selectedPart ? (
                  <p className="text-sm text-ink-soft">持っています（部屋で使えます）</p>
                ) : wearing[selectedPart.part] === selectedPart.value ? (
                  <p className="text-sm text-ink-soft">着ています</p>
                ) : (
                  <Button onClick={wear} disabled={pending} className="w-full">
                    {pending ? "着がえ中…" : "これを着る"}
                  </Button>
                )
              ) : (
                <>
                  <Button onClick={buy} disabled={pending || coinsShort(wallet.coins, selectedItem.price) > 0} className="w-full">
                    {pending ? "買っています…" : `🪙${selectedItem.price} で買う`}
                  </Button>
                  {coinsShort(wallet.coins, selectedItem.price) > 0 && (
                    <p className="text-xs text-ink-soft">あと 🪙{coinsShort(wallet.coins, selectedItem.price)} で買えます</p>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="text-center text-sm text-ink-soft">
              {kind === "stamp" ? "スタンプを選ぶと、絵を大きく見られます" : kind === "emote" ? "エモートを選ぶと、動きを試せます" : "品物を選ぶと、試着できます"}
            </p>
          )}
          {message && (
            <p role={message.ok ? "status" : "alert"} className={`text-center text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="品物の種類">
              {CATEGORIES.map((c) => (
                <button
                  key={c.kind}
                  type="button"
                  role="tab"
                  aria-selected={c.kind === kind}
                  disabled={!c.ready}
                  title={c.ready ? undefined : "近日追加"}
                  onClick={() => c.ready && changeKind(c.kind)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    c.kind === kind ? "bg-ink font-bold text-paper" : "bg-paper hover:bg-sakura/20 disabled:opacity-50 disabled:hover:bg-paper"
                  }`}
                >
                  {c.label}
                  {!c.ready && <span className="ml-1 text-[10px]">近日</span>}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-ink-soft">並び順</span>
              <select
                value={sort}
                onChange={(e) => changeSort(parseShopSort(e.target.value))}
                className="rounded-full border border-line bg-paper px-3 py-1"
              >
                {Object.entries(SHOP_SORTS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
            {shown.map((item) => {
              const info = describe(item.item_id)!;
              const has = owned.has(item.item_id);
              const isSelected = item.item_id === selected;
              return (
                <li key={item.item_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(item.item_id);
                      setMessage(null);
                    }}
                    aria-pressed={isSelected}
                    className={`flex w-full flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs transition ${
                      isSelected ? "border-accent bg-sakura/10" : "border-transparent bg-paper shadow-sm hover:border-line"
                    }`}
                  >
                    <span className="anim-paused flex h-[60px] items-center">
                      {info.type === "wallpaper" ? (
                        <span className="block h-12 w-16 rounded-xl border border-line" style={{ background: WALLPAPERS[info.id].bg }} />
                      ) : info.type === "furniture" ? (
                        <FurnitureArt id={info.id} className="max-h-12 w-16" />
                      ) : info.type === "form" ? (
                        <Mochi avatar={{ ...wearing, form: info.id }} size={info.id === "king" ? 34 : 56} seed={`shop-${item.item_id}`} />
                      ) : info.type === "stamp" ? (
                        <StampArt id={info.id} avatar={wearing} size={56} />
                      ) : info.type === "emote" ? (
                        <EmoteGlyph emote={info.id} size={30} />
                      ) : info.part === "desk" ? (
                        <DeskItem kind={info.value as Avatar["desk"]} size={52} level={3} />
                      ) : (
                        <Mochi avatar={withPart(wearing, info.part, info.value)} size={kind === "color" ? 52 : 60} seed={`shop-${item.item_id}`} />
                      )}
                    </span>
                    <span className="font-bold leading-tight">{info.label}</span>
                    {has ? (
                      <span className="rounded-full bg-yomogi/25 px-2 text-[11px] text-green-800">持っている</span>
                    ) : (
                      <span className="tabular-nums">🪙{item.price}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-soft">
            {kind === "stamp" || kind === "emote"
              ? `${category.free} は無料で、部屋でいつでも使えます。`
              : kind === "wallpaper" || kind === "furniture"
                ? `${category.free} は無料で、もちの部屋の模様がえで使えます。`
              : `${category.free} は無料で、着せかえからいつでも選べます。`}
          </p>
        </div>
      </div>
    </div>
  );
}
