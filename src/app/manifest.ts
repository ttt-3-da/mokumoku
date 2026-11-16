import type { MetadataRoute } from "next";

/** ホーム画面に追加したときの名前・アイコン・色 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mokumoku もくもく自習室",
    short_name: "Mokumoku",
    description: "おもちのアバターと一緒に、オンラインのもくもく自習室で勉強しよう。",
    lang: "ja",
    start_url: "/lobby",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7ef",
    theme_color: "#fbe3e9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
