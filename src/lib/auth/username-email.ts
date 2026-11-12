/**
 * Supabase Auth はメールアドレスが必須なので、ユーザーIDをダミーのメールアドレスに変換する。
 * `.invalid` は RFC 2606 で予約された「実在しない」TLD なので、誤って実在アドレスになることはない。
 * 確認メールは無効化しているため、このアドレスにメールが送られることはない。
 */
export const AUTH_EMAIL_DOMAIN = "users.mokumoku.invalid";

export function usernameToEmail(username: string): string {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}
