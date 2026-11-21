"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usernameToEmail } from "@/lib/auth/username-email";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { parseGoalHours } from "@/lib/goals";
import { parseOfflineLeave } from "@/lib/offline-leave";
import { validateBio, validateDisplayName, validatePassword } from "@/lib/validation";

export type FormState = { error?: string; saved?: boolean };

/** 表示名と自己紹介 */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireProfile();
  const name = validateDisplayName(String(formData.get("display_name") ?? ""));
  if (!name.ok) return { error: name.error };
  const bio = validateBio(String(formData.get("bio") ?? ""));
  if (!bio.ok) return { error: bio.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.value, bio: bio.value })
    .eq("id", me.id);
  if (error) return { error: error.message === "ng_word_profile" ? rpcErrorMessage(error) : "保存できませんでした" };

  revalidatePath("/", "layout");
  return { saved: true };
}

/** 公開範囲（プロフィールの公開・統計の公開） */
export async function updateVisibility(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireProfile();
  const isPublic = formData.get("is_public") === "on";
  const statsPublic = formData.get("stats_public") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_public: isPublic, stats_public: statsPublic })
    .eq("id", me.id);
  if (error) return { error: "保存できませんでした" };

  revalidatePath("/", "layout");
  return { saved: true };
}

/** 週の目標 */
export async function updateGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireProfile();
  const goal = parseGoalHours(String(formData.get("weekly_goal") ?? ""));
  if (!goal.ok) return { error: goal.error };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ weekly_goal_minutes: goal.value }).eq("id", me.id);
  if (error) return { error: "保存できませんでした" };

  revalidatePath("/", "layout");
  return { saved: true };
}

/** 電源が切れたときなど、知らせが止まってから退室にするまでの分 */
export async function updateOfflineLeave(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireProfile();
  const minutes = parseOfflineLeave(formData.get("offline_leave_minutes"));
  if (minutes === null) return { error: "選べる時間から選んでください" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ offline_leave_minutes: minutes }).eq("id", me.id);
  if (error) return { error: "保存できませんでした" };

  revalidatePath("/settings");
  return { saved: true };
}

/** 今のパスワードを確かめるため、もう一度ログインを試す */
async function verifyPassword(username: string, password: string): Promise<boolean> {
  if (!password) return false;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  return !error;
}

/** パスワード変更（今のパスワードの確認つき） */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireProfile();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const pw = validatePassword(next);
  if (!pw.ok) return { error: pw.error };
  if (next !== confirm) return { error: "新しいパスワードが確認用と一致しません" };
  if (next === current) return { error: "今と同じパスワードです" };
  if (!(await verifyPassword(me.username, current))) return { error: "今のパスワードが違います" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.value });
  if (error) {
    if (error.code === "weak_password") return { error: "もっと推測されにくいパスワードにしてください" };
    return { error: "変更できませんでした。時間をおいてお試しください" };
  }
  return { saved: true };
}

/** 退会。ユーザーIDとパスワードで本人確認してから、アカウントと記録を削除する */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireProfile();
  const confirmUsername = String(formData.get("confirm_username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (confirmUsername !== me.username) return { error: "確認のユーザーIDが違います" };
  if (!(await verifyPassword(me.username, password))) return { error: "パスワードが違います" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account", { p_confirm_username: confirmUsername });
  if (error) return { error: rpcErrorMessage(error) };

  // アカウントはもうないので、ブラウザに残ったログイン情報も消す
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
