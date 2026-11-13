import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeskItem, Mochi } from "@/components/mochi";
import { DEFAULT_AVATAR, UNLOCK_ITEM_LABEL, UNLOCKABLE_ITEMS, type Avatar, type UnlockItemId } from "@/lib/avatar";
import { ButtonLink, Card } from "@/components/ui";
import { formatMinutes } from "@/lib/pomodoro";
import { createClient, getAvatar, requireProfile } from "@/lib/supabase/server";
import type { StudySession } from "@/lib/types";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "おつかれさま" };

const REMOVED_MESSAGE: Record<string, string> = {
  kick: "オーナーによって、この部屋から退室になりました。",
  ban: "オーナーによって、この部屋から退室になりました（この部屋にはもう入れません）。",
  evacuate: "オーナーが全員を退室させたため、退室になりました。",
  deleted: "オーナーがこの部屋を削除したため、退室になりました。",
  "deleted-by-me": "部屋を削除しました。",
};

export default async function SessionDonePage({ params, searchParams }: PageProps<"/sessions/[id]/done">) {
  const { id } = await params;
  const { removed } = await searchParams;
  const me = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!data) notFound();
  const session = data as StudySession;
  if (!session.ended_at) redirect(`/rooms/${session.room_id}/live`);

  const [{ data: room }, avatar, { data: unlockRows }, { data: coinRows }] = await Promise.all([
    supabase.from("rooms").select("name, icon, timer_mode").eq("id", session.room_id).maybeSingle(),
    getAvatar(me.id),
    supabase.from("unlocks").select("item_id").eq("user_id", me.id).eq("session_id", session.id),
    supabase.from("coin_transactions").select("amount, reason, detail").eq("session_id", session.id),
  ]);
  const coins = (coinRows ?? []) as { amount: number; reason: string; detail: string | null }[];
  const coinTotal = coins.reduce((s, c) => s + c.amount, 0);
  const unlocked = (unlockRows ?? []).map((r) => r.item_id as string).filter((x): x is UnlockItemId => x in UNLOCK_ITEM_LABEL);

  // DB の session_minutes と同じ計算（切り捨て）
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000),
  );

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-4">
      <Mochi avatar={avatar} size={120} seed={me.id} celebrate={minutes >= 1} className="animate-mochi-drop" />
      <h1 className="text-2xl font-bold">おつかれさま！</h1>
      {typeof removed === "string" && REMOVED_MESSAGE[removed] && (
        <p role="status" className="w-full rounded-2xl bg-kinako/30 px-4 py-2 text-center text-sm">
          {REMOVED_MESSAGE[removed]}
        </p>
      )}

      {unlocked.length > 0 && (
        <Card className="w-full border-2 border-accent">
          <h2 className="mb-3 text-center font-bold">🎁 新しいアイテムを手に入れた！</h2>
          <ul className="flex flex-wrap justify-center gap-4">
            {unlocked.map((item) => (
              <li key={item} className="animate-mochi-drop flex w-28 flex-col items-center gap-1 text-center text-sm">
                <UnlockPreview item={item} base={avatar} seed={me.id} />
                <b>{UNLOCK_ITEM_LABEL[item]}</b>
                <span className="text-[11px] text-ink-soft">{UNLOCKABLE_ITEMS[item]}</span>
              </li>
            ))}
          </ul>
          <ButtonLink href="/avatar" variant="secondary" className="mt-4 w-full">
            さっそく着せかえる
          </ButtonLink>
        </Card>
      )}

      <Card className="w-full">
        <dl className="grid grid-cols-2 gap-4 text-center">
          <div>
            <dt className="text-xs text-ink-soft">学習時間</dt>
            <dd className="text-2xl font-bold">{formatMinutes(minutes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">ポモドーロ</dt>
            <dd className="text-2xl font-bold">
              {room?.timer_mode === "pomodoro" ? `${session.pomodoros}回` : "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-ink-soft">やったこと</dt>
            <dd className="mt-1 break-words font-bold">{session.task}</dd>
            {room && (
              <dd className="mt-1 text-xs text-ink-soft">
                {room.icon} {room.name}
              </dd>
            )}
          </div>
        </dl>
      </Card>

      {coinTotal > 0 && (
        <Card className="w-full text-center">
          <p className="text-2xl font-bold tabular-nums">🪙 +{coinTotal}</p>
          <ul className="mt-1 flex flex-wrap justify-center gap-x-3 text-xs text-ink-soft">
            {coins.map((c, i) => (
              <li key={i}>
                {c.reason === "study" ? "勉強" : c.reason === "pomodoro" ? "ポモドーロ" : `連続${c.detail?.split(":")[1] ?? ""}日ボーナス`} +{c.amount}
              </li>
            ))}
          </ul>
          <ButtonLink href="/shop" variant="ghost" className="mt-2">
            ショップをのぞく
          </ButtonLink>
        </Card>
      )}

      {minutes >= 1 ? (
        <Card className="w-full">
          <p className="mb-3 text-center text-xs text-ink-soft">✅ この勉強は「記録」に残りました</p>
          <NoteForm sessionId={session.id} initial={session.note ?? ""} />
        </Card>
      ) : (
        <Card className="w-full text-center text-sm text-ink-soft">
          1分未満だったので、記録には残りません。
          <ButtonLink href="/lobby" variant="secondary" className="mt-3 w-full">
            ロビーへ戻る
          </ButtonLink>
        </Card>
      )}    </div>
  );
}

function UnlockPreview({ item, base, seed }: { item: UnlockItemId; base: Avatar; seed: string }) {
  const [part, value] = item.split(":") as ["head" | "desk" | "hachimaki", string];
  if (part === "desk") return <DeskItem kind={value as Avatar["desk"]} size={64} level={1} />;
  const avatar = { ...DEFAULT_AVATAR, color: base.color, [part]: value } as Avatar;
  return <Mochi avatar={avatar} size={64} seed={seed} state={part === "hachimaki" ? "focus" : "idle"} />;
}