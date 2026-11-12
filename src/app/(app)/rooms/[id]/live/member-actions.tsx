"use client";

import { useState } from "react";
import { ReportButton } from "@/components/report-button";
import { Button } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

export type RoomRole = "owner" | "moderator";

/**
 * 選んだ在室者への操作。
 * - だれでも：通報
 * - オーナー・モデレーター：キック・BAN（オーナーは対象外。モデレーターを対象にできるのはオーナーだけ）
 * - オーナー：モデレーターの任命・解除
 */
export function MemberActions({
  roomId,
  target,
  myRole,
  targetRole,
  onDone,
}: {
  roomId: string;
  target: { userId: string; displayName: string };
  myRole: RoomRole | null;
  targetRole: RoomRole | null;
  onDone: (action: "kick" | "ban" | "role") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canModerate = myRole !== null && targetRole !== "owner" && (targetRole !== "moderator" || myRole === "owner");
  const canAppoint = myRole === "owner" && targetRole !== "owner";

  async function run(action: "kick" | "ban" | "role") {
    const message =
      action === "kick"
        ? `${target.displayName} さんを部屋から退室させますか？（また入室はできます）`
        : action === "ban"
          ? `${target.displayName} さんを BAN しますか？この部屋には二度と入室できなくなります。`
          : null;
    if (message && !window.confirm(message)) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      action === "kick"
        ? await supabase.rpc("kick_member", { p_room_id: roomId, p_user_id: target.userId })
        : action === "ban"
          ? await supabase.rpc("ban_member", { p_room_id: roomId, p_user_id: target.userId })
          : await supabase.rpc("set_moderator", {
              p_room_id: roomId,
              p_user_id: target.userId,
              p_on: targetRole !== "moderator",
            });
    setBusy(false);
    if (error) return setError(rpcErrorMessage(error));
    onDone(action);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-cream px-3 py-2 text-sm">
      <span className="min-w-0 truncate">
        <b>{target.displayName}</b> さん
        {targetRole === "owner" && <span className="ml-1 text-xs">👑 オーナー</span>}
        {targetRole === "moderator" && <span className="ml-1 text-xs">🛡️ モデレーター</span>}
      </span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {canAppoint && (
          <Button variant="ghost" className="px-3 py-1 text-xs" disabled={busy} onClick={() => run("role")}>
            {targetRole === "moderator" ? "モデレーターを外す" : "モデレーターにする"}
          </Button>
        )}
        {canModerate && (
          <>
            <Button variant="secondary" className="px-3 py-1 text-xs" disabled={busy} onClick={() => run("kick")}>
              キック
            </Button>
            <Button variant="danger" className="px-3 py-1 text-xs" disabled={busy} onClick={() => run("ban")}>
              BAN
            </Button>
          </>
        )}
        <ReportButton targetType="user" targetId={target.userId} />
      </span>
      {error && (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
