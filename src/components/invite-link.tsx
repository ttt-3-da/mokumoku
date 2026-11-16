"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

const noSubscribe = () => () => {};

// サーバーではサイトのアドレスがわからないので、画面が出てから「https://…」をつける
function useInviteUrl(code: string) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  return `${origin}/r/${code}`;
}

/** スマホの「共有」（LINE などに送る）が使えるか */
function useCanShare() {
  return useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
}

async function copy(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/** 招待リンク。リンクそのものを出して、コピーや（スマホなら）LINE などへの共有ができる */
export function InviteLink({ code, roomName, hint = "このリンクを開いた人は、入室前の画面に直接来られます。" }: { code: string; roomName: string; hint?: string }) {
  const url = useInviteUrl(code);
  const [copied, setCopied] = useState(false);
  const canShare = useCanShare();

  return (
    <div className="flex flex-col gap-1.5">
      <a href={url} className="break-all rounded-xl bg-cream px-3 py-2 text-sm font-bold text-accent-strong underline-offset-2 hover:underline" aria-label="招待リンク">
        {url}
      </a>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={async () => {
            if (await copy(url)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? "✅ コピーしました" : "🔗 リンクをコピー"}
        </Button>
        {canShare && (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => void navigator.share({ title: `Mokumoku「${roomName}」`, text: `「${roomName}」でいっしょに勉強しよう`, url }).catch(() => {})}
          >
            📤 送る
          </Button>
        )}
      </div>
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </div>
  );
}

/** 部屋の中の上のところに置く、ワンタップで招待リンクをコピーするボタン */
export function CopyInviteButton({ code }: { code: string }) {
  const url = useInviteUrl(code);
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copy(url)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      title={url}
      className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-xs font-bold transition hover:bg-sakura/20"
    >
      {copied ? "✅ コピーした" : (
        <>
          🔗<span className="hidden sm:inline"> 招待リンク</span>
        </>
      )}
    </button>
  );
}
