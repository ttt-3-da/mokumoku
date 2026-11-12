/**
 * ログイン後の戻り先。オープンリダイレクトを防ぐため、
 * 「/ で始まり // や /\ で始まらない」同一オリジン内のパスだけを許可する。
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/lobby"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.startsWith("/login")) return fallback;
  return raw;
}
