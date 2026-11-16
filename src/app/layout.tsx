import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import { COLOR_SCHEME_SCRIPT } from "@/lib/color-scheme";
import "./globals.css";

const maru = Zen_Maru_Gothic({
  variable: "--font-maru",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Mokumoku", template: "%s | Mokumoku" },
  description: "おもちのアバターと一緒に、オンラインのもくもく自習室で勉強しよう。",
  applicationName: "Mokumoku",
  appleWebApp: { capable: true, title: "Mokumoku", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#fbe3e9" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme は描画前のスクリプトで付けるので、サーバーの HTML と食い違っても警告しない
    <html lang="ja" className={`${maru.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
