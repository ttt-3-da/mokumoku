import { ImageResponse } from "next/og";
import { formatMinutes } from "@/lib/pomodoro";
import { mochiSvgDataUrl } from "@/lib/mochi-svg";
import { CARD_GLYPHS, shareDate } from "@/lib/share";
import { getSharedSession } from "./data";

export const alt = "Mokumoku の勉強の記録";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 画像に出す字だけのフォントを Google Fonts から読む（送るのは決まった字だけで、利用者の情報は送らない）。
 * 読めなかったら、字のフォントなしで描く
 */
let fontPromise: Promise<ArrayBuffer | null> | null = null;
function loadFont() {
  fontPromise ??= (async () => {
    try {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700&text=${encodeURIComponent(CARD_GLYPHS)}`)).text();
      const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
      if (!url) return null;
      return await (await fetch(url)).arrayBuffer();
    } catch {
      return null;
    }
  })();
  return fontPromise;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, font] = await Promise.all([getSharedSession(id), loadFont()]);
  const fonts = font ? [{ name: "Zen Maru Gothic", data: font, weight: 700 as const, style: "normal" as const }] : undefined;

  if (!s) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fbf7ef", fontSize: 96, color: "#3f3a36", fontFamily: "Zen Maru Gothic" }}>
          Mokumoku
        </div>
      ),
      { ...size, fonts },
    );
  }

  const mochi = mochiSvgDataUrl(s.avatar, 360);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(135deg, #fbf7ef 0%, #fbe3e9 100%)",
          padding: "0 90px",
          gap: 60,
          fontFamily: "Zen Maru Gothic",
          color: "#3f3a36",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse の中は img で描く */}
        <img src={mochi} width={360} height={360} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 34, color: "#8a8079" }}>{`${shareDate(s.endedAt)} の記録`}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 120, color: "#d9547a" }}>{formatMinutes(s.minutes)}</span>
          </div>
          <div style={{ fontSize: 56 }}>勉強しました</div>
          {(s.pomodoros > 0 || s.todosDone > 0) && (
            <div style={{ display: "flex", gap: 30, fontSize: 32, color: "#8a8079" }}>
              {s.pomodoros > 0 && <span>{`ポモドーロ ${s.pomodoros}回`}</span>}
              {s.todosDone > 0 && <span>{`ToDo ${s.todosDone}個おわらせた`}</span>}
            </div>
          )}
          <div style={{ marginTop: 20, fontSize: 36, color: "#8a8079" }}>Mokumoku もくもく自習室</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
