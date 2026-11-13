"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Mochi } from "@/components/mochi";
import { Button, Card } from "@/components/ui";
import { COLORS, type Avatar, type AvatarColor } from "@/lib/avatar";
import { rpcErrorMessage } from "@/lib/errors";
import { coinsShort, parseShopSort, SHOP_SORTS, sortShopItems, type ShopSort } from "@/lib/shop";
import { createClient } from "@/lib/supabase/client";
import type { ShopItem, Wallet } from "@/lib/supabase/server";
import { saveAvatar } from "../avatar/actions";

/** 種類のタブ。色以外は2回目以降に追加する */
const CATEGORIES = [
  { kind: "color", label: "体の色", ready: true },
  { kind: "eyes", label: "目", ready: false },
  { kind: "mouth", label: "口", ready: false },
  { kind: "cheeks", label: "ほっぺ", ready: false },
  { kind: "accessory", label: "アクセサリー", ready: false },
] as const;

const SORT_KEY = "mokumoku:shop-sort";

export function ShopView({
  seed,
  avatar,
  wallet: initialWallet,
  items,
}: {
  seed: string;
  avatar: Avatar;
  wallet: Wallet;
  items: ShopItem[];
}) {
  const router = useRouter();
  const [wallet, setWallet] = useState(initialWallet);
  const [wearing, setWearing] = useState(avatar);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<ShopSort>("recommended");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

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
  const colorItems = useMemo(
    () => sortShopItems(items.filter((i) => i.kind === "color" && i.item_id.slice(6) in COLORS), owned, sort),
    [items, owned, sort],
  );
  const selectedItem = colorItems.find((i) => i.item_id === selected) ?? null;
  const selectedColor = selectedItem ? (selectedItem.item_id.slice(6) as AvatarColor) : null;
  const preview: Avatar = selectedColor ? { ...wearing, color: selectedColor } : wearing;

  function changeSort(v: ShopSort) {
    setSort(v);
    try {
      localStorage.setItem(SORT_KEY, v);
    } catch {
      // 保存できなくても並び替えはできる
    }
  }

  function buy() {
    if (!selectedItem) return;
    const name = COLORS[selectedColor!].label;
    if (!window.confirm(`「${name}」を 🪙${selectedItem.price} で買いますか？（返品はできません）`)) return;
    setMessage(null);
    startTransition(async () => {
      const { data, error } = await createClient().rpc("buy_item", { p_item_id: selectedItem.item_id });
      if (error) {
        setMessage({ ok: false, text: rpcErrorMessage(error) });
        return;
      }
      setWallet((w) => ({ coins: typeof data === "number" ? data : w.coins - selectedItem.price, owned: [...w.owned, selectedItem.item_id] }));
      setMessage({ ok: true, text: `「${name}」を買いました！` });
      router.refresh(); // ヘッダーのコインを更新
    });
  }

  function wear() {
    if (!selectedColor) return;
    setMessage(null);
    startTransition(async () => {
      const res = await saveAvatar({ ...wearing, color: selectedColor });
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
        <span className="rounded-full bg-paper px-3 py-1 text-sm font-bold tabular-nums shadow-sm" aria-label={`所持コイン ${wallet.coins}枚`}>
          🪙 {wallet.coins}
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
          <Mochi avatar={preview} size={140} seed={seed} label="試着中のもち" />
          {selectedItem ? (
            <>
              <p className="text-center font-bold">{COLORS[selectedColor!].label}</p>
              {owned.has(selectedItem.item_id) ? (
                wearing.color === selectedColor ? (
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
            <p className="text-center text-sm text-ink-soft">品物を選ぶと、試着できます</p>
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
                  aria-selected={c.kind === "color"}
                  disabled={!c.ready}
                  title={c.ready ? undefined : "近日追加"}
                  className={`rounded-full px-3 py-1 text-sm ${
                    c.kind === "color" ? "bg-ink font-bold text-paper" : "bg-paper text-ink-soft disabled:opacity-50"
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
            {colorItems.map((item) => {
              const color = item.item_id.slice(6) as AvatarColor;
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
                    <span className="anim-paused">
                      <Mochi avatar={{ ...wearing, color }} size={52} seed={`shop-${color}`} />
                    </span>
                    <span className="font-bold leading-tight">{COLORS[color].label}</span>
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
          <p className="text-xs text-ink-soft">白もち・さくら・よもぎは無料で、着せかえからいつでも選べます。</p>
        </div>
      </div>
    </div>
  );
}
