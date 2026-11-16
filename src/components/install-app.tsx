"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * ホーム画面に追加する。Android・パソコンの Chrome などはボタンで追加でき、
 * iPhone・iPad（Safari）はボタンが使えないので、やり方を出す
 */
export function InstallApp() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // ブラウザの状態は描画のあとでしかわからないので、ここで反映する
    queueMicrotask(() => {
      setInstalled(standalone);
      setIos(isIos);
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="text-sm">✅ ホーム画面から開いています。</p>;
  if (event) {
    return (
      <Button
        onClick={async () => {
          await event.prompt();
          const { outcome } = await event.userChoice;
          if (outcome === "accepted") setInstalled(true);
          setEvent(null);
        }}
      >
        📲 ホーム画面に追加する
      </Button>
    );
  }
  if (ios) {
    return (
      <p className="text-sm">
        Safari の下（iPad は上）にある <b>共有ボタン（□に↑）</b> を押して、<b>「ホーム画面に追加」</b> を選んでください。
      </p>
    );
  }
  return (
    <p className="text-sm">
      ブラウザのメニュー（⋮ など）から <b>「ホーム画面に追加」</b> または <b>「アプリをインストール」</b> を選んでください。
    </p>
  );
}
