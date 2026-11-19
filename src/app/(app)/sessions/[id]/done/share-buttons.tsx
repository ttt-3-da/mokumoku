"use client";

import { useState, useSyncExternalStore } from "react";
import { rpcErrorMessage } from "@/lib/errors";
import { shareText, shareUrl, xIntentUrl } from "@/lib/share";
import { createClient } from "@/lib/supabase/client";

const noSubscribe = () => () => {};

/**
 * 勉強の記録を X などでシェアする。押したときに初めて記録カードを公開する（それまではだれにも見えない）。
 * シェアをやめると、リンクを開いても見えなくなる
 */
export function ShareButtons({ sessionId, minutes, shared: initialShared }: { sessionId: string; minutes: number; shared: boolean }) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const [shared, setShared] = useState(initialShared);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = shareUrl(origin, sessionId);
  const text = shareText(minutes);

  // 投稿画面をすぐ開けるよう（ポップアップを止められないよう）、公開の処理は待たずに送る
  function publish() {
    setError(null);
    if (shared) return;
    setShared(true);
    void createClient()
      .rpc("share_session", { p_session_id: sessionId })
      .then(({ error }) => {
        if (error) {
          setShared(false);
          setError(rpcErrorMessage(error));
        }
      });
  }

  async function stop() {
    if (!window.confirm("シェアをやめますか？ リンクを開いても、記録カードが見えなくなります。")) return;
    const { error } = await createClient().rpc("unshare_session", { p_session_id: sessionId });
    if (error) return setError(rpcErrorMessage(error));
    setShared(false);
  }

  const button = "flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <a
          href={xIntentUrl(text, url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={publish}
          className={`${button} bg-[#111] text-white hover:bg-black`}
        >
          𝕏 でシェア
        </a>
        {canShare ? (
          <button
            type="button"
            className={`${button} bg-cream hover:bg-sakura/20`}
            onClick={() => {
              publish();
              void navigator.share({ title: "Mokumoku", text, url }).catch(() => {});
            }}
          >
            📤 ほかのアプリで送る
          </button>
        ) : (
          <button
            type="button"
            className={`${button} bg-cream hover:bg-sakura/20`}
            onClick={async () => {
              publish();
              try {
                await navigator.clipboard.writeText(`${text}\n${url}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // コピーできないブラウザでは何もしない
              }
            }}
          >
            {copied ? "✅ コピーしました" : "🔗 リンクをコピー"}
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        シェアすると、表示名・もち・勉強した時間などの記録カードを、リンクを開いただれでも見られるようになります（やったことや部屋の名前は出ません）。
        {shared && (
          <button type="button" onClick={stop} className="ml-1 underline hover:text-red-700">
            シェアをやめる
          </button>
        )}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
