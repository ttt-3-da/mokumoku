import type { Metadata } from "next";
import { ButtonLink, Card } from "@/components/ui";
import { parseShopItem } from "@/lib/avatar";
import { getEmote } from "@/lib/emotes";
import { getStamp } from "@/lib/stamps";
import { BADGES, isBadgeId } from "@/lib/badges";
import { formatCoins } from "@/lib/shop";
import { createClient, getWallet } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "コイン" };

type Row = { amount: number; reason: string; detail: string | null; created_at: string; room_name: string | null };

const fmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 履歴の1行の説明 */
function describe(r: Row): string {
  switch (r.reason) {
    case "signup":
      return r.detail === "seed" ? "テスト用のコイン" : "登録ボーナス";
    case "study":
      return r.detail === "seed" ? "テスト用のコイン" : `勉強${r.room_name ? `（${r.room_name}）` : ""}`;
    case "pomodoro":
      return `ポモドーロ完了${r.room_name ? `（${r.room_name}）` : ""}`;
    case "streak":
      return `連続${r.detail?.split(":")[1] ?? ""}日ボーナス`;
    case "purchase": {
      const detail = r.detail ?? "";
      const [kind, id] = detail.split(":");
      const name =
        kind === "stamp"
          ? `スタンプ「${getStamp(id)?.label ?? id}」`
          : kind === "emote"
            ? `エモート「${getEmote(id)?.label ?? id}」`
            : `「${parseShopItem(detail)?.label ?? detail}」`;
      return `${name}を買った`;
    }
    case "goal":
      return "週の目標を達成";
    case "badge": {
      const id = r.detail?.split(":")[1];
      return isBadgeId(id) ? `バッジ「${BADGES[id].name}」` : "バッジ";
    }
    default:
      return r.reason;
  }
}

export default async function CoinsPage() {
  const supabase = await createClient();
  const [wallet, { data }] = await Promise.all([getWallet(), supabase.rpc("list_coin_history", { p_limit: 100 })]);
  const rows = (data ?? []) as Row[];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">コイン</h1>
        <span className="rounded-full bg-paper px-3 py-1 text-lg font-bold tabular-nums shadow-sm">🪙 {formatCoins(wallet.coins)}</span>
        <ButtonLink href="/shop" variant="secondary" className="ml-auto">
          ショップへ
        </ButtonLink>
      </div>

      <Card>
        <h2 className="mb-2 font-bold">コインのもらい方</h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>📚 勉強10分ごとに 🪙1（退室したときにまとめてもらえます）</li>
          <li>🍅 ポモドーロ1回完了で 🪙2</li>
          <li>🔥 連続3日で 🪙10、7日で 🪙30、30日で 🪙100</li>
          <li>🏁 週の目標を達成すると 🪙20（週に1回・目標は設定から）</li>
          <li>🏅 実績バッジを取ると 🪙5〜30</li>
        </ul>
        <p className="mt-2 text-xs text-ink-soft">部屋のテーマは、コインではなく部屋にたまる🍅（みんなの勉強時間25分で1個）で買います。</p>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">履歴</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">まだありません。</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r, i) => (
              <li key={i} className="flex items-baseline gap-3 py-2 text-sm">
                <time dateTime={r.created_at} className="w-24 shrink-0 text-xs tabular-nums text-ink-soft">
                  {fmt.format(new Date(r.created_at))}
                </time>
                <span className="min-w-0 flex-1 truncate">{describe(r)}</span>
                <b className={`shrink-0 tabular-nums ${r.amount > 0 ? "text-green-700" : "text-ink-soft"}`}>
                  {r.amount > 0 ? `+${r.amount}` : r.amount}
                </b>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
