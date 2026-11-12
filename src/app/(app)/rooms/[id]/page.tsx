import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mochi } from "@/components/mochi";
import { parseAvatar } from "@/lib/avatar";
import { TimerBadge } from "@/components/timer-badge";
import { ReportButton } from "@/components/report-button";
import { ButtonLink, Card, Tag } from "@/components/ui";
import { createClient, requireProfile } from "@/lib/supabase/server";
import type { RoomPreview } from "@/lib/types";
import { EnterForm } from "./enter-form";
import { PendingWatcher } from "./pending-watcher";

export const metadata: Metadata = { title: "入室" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RoomEntryPage({ params, searchParams }: PageProps<"/rooms/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { invite } = await searchParams;
  const inviteCode = typeof invite === "string" && invite.length <= 32 ? invite : null;

  const me = await requireProfile();
  const supabase = await createClient();

  const [previewRes, historyRes, openRes] = await Promise.all([
    supabase.rpc("get_room_preview", { p_room_id: id, p_invite_code: inviteCode }),
    supabase
      .from("study_sessions")
      .select("task")
      .eq("user_id", me.id)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase.from("study_sessions").select("room_id").eq("user_id", me.id).is("ended_at", null).maybeSingle(),
  ]);

  const preview = previewRes.data as RoomPreview | null;
  if (!preview) notFound();
  const { room, occupants } = preview;

  // 過去の「やること」を新しい順に重複なしで最大8件
  const history = [...new Set((historyRes.data ?? []).map((r) => r.task as string))].slice(0, 8);
  const alreadyHere = openRes.data?.room_id === room.id;
  const inOtherRoom = Boolean(openRes.data) && !alreadyHere;
  const full = room.active_count >= room.capacity;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cream text-3xl" aria-hidden>
            {room.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{room.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1">
              {room.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </div>
        </div>
        {room.owner_id !== me.id && <ReportButton targetType="room" targetId={room.id} className="self-end" />}
        {room.description && <p className="whitespace-pre-wrap text-sm text-ink-soft">{room.description}</p>}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <TimerBadge {...room} />
          <span className="font-bold tabular-nums">
            👤 {room.active_count}/{room.capacity}人
          </span>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold">いまいる人</h2>
          {occupants.length === 0 ? (
            <p className="text-sm text-ink-soft">まだだれもいません。一番乗りしよう！</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {occupants.map((o) => (
                <li key={o.user_id} className="flex w-16 flex-col items-center gap-1 text-center">
                  <Mochi avatar={parseAvatar(o.avatar)} size={52} state="focus" seed={o.user_id} />
                  <span className="w-full truncate text-xs">{o.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {preview.is_staff && preview.invite_code && (
        <Card className="flex flex-col gap-1 text-sm">
          <span className="font-bold">招待URL（オーナー・モデレーターにだけ表示）</span>
          <code className="break-all rounded-xl bg-cream px-3 py-2 text-xs">/r/{preview.invite_code}</code>
          {(preview.pending_count ?? 0) > 0 && (
            <span className="text-accent-strong">入室の申請が {preview.pending_count} 件あります。入室後の「⚙️ 設定」から承認できます。</span>
          )}
        </Card>
      )}

      {room.closed_at ? (
        <Card className="text-center text-sm text-ink-soft">この部屋は閉じられました。</Card>
      ) : preview.is_banned ? (
        <Card className="text-center text-sm text-ink-soft">この部屋には入室できません。</Card>
      ) : preview.is_pending ? (
        <Card className="text-center text-sm">
          <p>入室を申請中です。オーナーが承認すると入れるようになります。</p>
          <p className="mt-1 text-xs text-ink-soft">この画面は自動で更新されます。</p>
          <PendingWatcher />
        </Card>
      ) : alreadyHere ? (
        <ButtonLink href={`/rooms/${room.id}/live`} className="self-center">
          部屋に戻る
        </ButtonLink>
      ) : full ? (
        <Card className="text-center text-sm text-ink-soft">いまは満員です。少し待ってからもう一度来てね。</Card>
      ) : (
        <Card>
          {inOtherRoom && (
            <p className="mb-3 rounded-xl bg-kinako/30 px-3 py-2 text-sm">
              別の部屋に入室中です。この部屋に入ると、前の部屋からは自動で退室します。
            </p>
          )}
          {room.visibility === "approval" && !preview.is_member && !preview.is_staff && (
            <p className="mb-3 rounded-xl bg-cream px-3 py-2 text-sm">🔒 承認制の部屋です。入室するとオーナーに申請が届きます。</p>
          )}
          <EnterForm roomId={room.id} history={history} inviteCode={inviteCode} />
        </Card>
      )}
    </div>
  );
}
