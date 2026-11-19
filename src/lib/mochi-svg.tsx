import { renderToStaticMarkup } from "react-dom/server.edge";
import { MochiArt } from "@/components/mochi";
import type { Avatar } from "@/lib/avatar";

/**
 * もちを SVG の data URL にする（記録カードの画像に入れるため）。
 * ImageResponse の中では React の SVG をそのまま描けないので、いったん文字列にする
 */
export function mochiSvgDataUrl(avatar: Avatar, size: number): string {
  const markup = renderToStaticMarkup(<MochiArt uid="sharecard" avatar={avatar} size={size} seed="share-card" celebrate />);
  const svg = markup.match(/<svg[\s\S]*<\/svg>/)?.[0] ?? "";
  const withNs = svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;base64,${Buffer.from(withNs).toString("base64")}`;
}
