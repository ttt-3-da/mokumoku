"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

/** 部屋の削除（オーナーのみ）。押すと、何が起きるかを見せてから、もう一度押して消す */
export function DeleteRoom({
  roomName,
  onDeleteRoom,
  className = "",
}: {
  roomName: string;
  onDeleteRoom: () => Promise<string | null>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const e = await onDeleteRoom();
    setBusy(false);
    if (e) setError(e);
  }

  return (
    <section aria-label="部屋の削除" className={`flex flex-col gap-2 rounded-xl border-2 border-red-200 bg-red-50/60 p-3 ${className}`}>
      <span className="font-bold text-red-700">🗑️ この部屋を削除する</span>
      {!open ? (
        <>
          <p className="text-xs text-ink-soft">部屋がいらなくなったら、ここから削除できます。</p>
          <Button variant="danger" className="self-start px-4 py-1.5 text-sm" onClick={() => setOpen(true)}>
            部屋を削除する…
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm">
            「<b>{roomName}</b>」を削除すると：
          </p>
          <ul className="ml-4 list-disc text-xs text-ink">
            <li>いま部屋にいる全員が退室になります</li>
            <li>ロビーの一覧や招待リンクから入れなくなります</li>
            <li>元に戻せません</li>
            <li>みんなの勉強の記録は「削除された部屋」として残ります</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" className="px-4 py-1.5 text-sm" disabled={busy} onClick={run}>
              {busy ? "削除しています…" : "削除する"}
            </Button>
            <Button variant="ghost" className="px-4 py-1.5 text-sm" disabled={busy} onClick={() => setOpen(false)}>
              やめる
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

/** 入室前の画面から部屋を削除する（オーナーのみ）。消したらロビーへ */
export function DeleteRoomFromEntry({ roomId, roomName }: { roomId: string; roomName: string }) {
  const router = useRouter();
  async function remove() {
    const { error } = await createClient().rpc("delete_room", { p_room_id: roomId });
    if (error) return rpcErrorMessage(error);
    router.replace("/lobby");
    router.refresh();
    return null;
  }
  return <DeleteRoom roomName={roomName} onDeleteRoom={remove} />;
}
