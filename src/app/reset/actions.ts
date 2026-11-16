"use server";

import { usernameToEmail } from "@/lib/auth/username-email";
import { createClient } from "@/lib/supabase/server";
import { validatePassword, validateUsername } from "@/lib/validation";

export type ResetState = { error?: string; username?: string; newCode?: string };

/** ユーザーID＋復活コードで新しいパスワードにして、そのままログインする */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const usernameRaw = String(formData.get("username") ?? "");
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const keep = { username: usernameRaw };

  const username = validateUsername(usernameRaw);
  if (!username.ok || !code.trim()) return { ...keep, error: "ユーザーIDか復活コードが違います" };
  const pw = validatePassword(password);
  if (!pw.ok) return { ...keep, error: pw.error };
  if (password !== confirm) return { ...keep, error: "確認用のパスワードが一致しません" };

  const supabase = await createClient();
  // ほかの人でログインしたままだと、その人として呼ばれてしまうので先に出る
  await supabase.auth.signOut();
  const { data, error } = await supabase.rpc("reset_password_with_code", {
    p_username: username.value,
    p_code: code,
    p_new_password: pw.value,
  });
  if (error) return { ...keep, error: "変更できませんでした。時間をおいてお試しください" };
  const result = data as { code?: string; error?: string };
  if (result.error === "too_many_attempts") {
    return { ...keep, error: "まちがいが続いたので、15分ほど待ってからもう一度お試しください" };
  }
  if (!result.code) return { ...keep, error: "ユーザーIDか復活コードが違います" };

  await supabase.auth.signInWithPassword({ email: usernameToEmail(username.value), password: pw.value });
  return { username: username.value, newCode: result.code };
}
