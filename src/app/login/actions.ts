"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth/username-email";
import { safeNextPath } from "@/lib/auth/next-path";
import { validateDisplayName, validatePassword, validateUsername } from "@/lib/validation";

export type AuthState = { error?: string; username?: string; displayName?: string };

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const usernameRaw = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const username = validateUsername(usernameRaw);
  if (!username.ok || !password) {
    return { error: "ユーザーIDまたはパスワードが違います", username: usernameRaw };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username.value),
    password,
  });

  if (error) {
    // ユーザーIDが存在するかどうかを推測されないよう、メッセージは共通にする
    return { error: "ユーザーIDまたはパスワードが違います", username: usernameRaw };
  }

  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const usernameRaw = String(formData.get("username") ?? "");
  const displayNameRaw = String(formData.get("display_name") ?? "");
  const password = String(formData.get("password") ?? "");
  const keep = { username: usernameRaw, displayName: displayNameRaw };

  const username = validateUsername(usernameRaw);
  if (!username.ok) return { ...keep, error: username.error };
  const displayName = validateDisplayName(displayNameRaw || username.value);
  if (!displayName.ok) return { ...keep, error: displayName.error };
  const pw = validatePassword(password);
  if (!pw.ok) return { ...keep, error: pw.error };

  const supabase = await createClient();

  const { data: available, error: rpcError } = await supabase.rpc("is_username_available", {
    p_username: username.value,
  });
  if (rpcError) return { ...keep, error: "登録できませんでした。時間をおいてお試しください" };
  if (!available) return { ...keep, error: "このユーザーIDはすでに使われています" };

  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username.value),
    password: pw.value,
    options: { data: { username: username.value, display_name: displayName.value } },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { ...keep, error: "このユーザーIDはすでに使われています" };
    }
    if (error.code === "weak_password") return { ...keep, error: "もっと推測されにくいパスワードにしてください" };
    return { ...keep, error: "登録できませんでした。時間をおいてお試しください" };
  }
  if (!data.session) {
    // 確認メールが有効になっていると session が返らない（設定ミス）
    return { ...keep, error: "登録はできましたが、ログインできませんでした。管理者に連絡してください" };
  }

  redirect("/lobby?tour=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
