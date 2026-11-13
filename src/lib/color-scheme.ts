/** 見た目のモード（自動・ライト・ダーク）。このブラウザの localStorage に保存する */
export type ColorSchemePref = "auto" | "light" | "dark";

export const COLOR_SCHEME_KEY = "mokumoku:color-scheme";

export const COLOR_SCHEME_LABEL: Record<ColorSchemePref, string> = {
  auto: "自動（端末に合わせる）",
  light: "ライト",
  dark: "ダーク",
};

export function parseColorScheme(v: unknown): ColorSchemePref {
  return v === "light" || v === "dark" ? v : "auto";
}

export function resolveColorScheme(pref: ColorSchemePref, systemDark: boolean): "light" | "dark" {
  return pref === "auto" ? (systemDark ? "dark" : "light") : pref;
}

/**
 * 最初の描画の前に <html data-theme> を決めるスクリプト（ちらつき防止）。
 * 自動のときは端末の設定が変わったら追いかける
 */
export const COLOR_SCHEME_SCRIPT = `(function(){try{var k=${JSON.stringify(COLOR_SCHEME_KEY)};var m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var d=p==="dark"||(p!=="light"&&m.matches);document.documentElement.dataset.theme=d?"dark":"light"}a();m.addEventListener("change",a);window.__applyColorScheme=a}catch(e){}})();`;
