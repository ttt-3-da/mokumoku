import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile, createClient } from "@/lib/supabase/server";
import { AdminView, type FeedbackRow, type ReportRow, type UserRow } from "./admin-view";

export const metadata: Metadata = { title: "管理" };

export default async function AdminPage() {
  const me = await requireProfile();
  if (!me.is_admin) notFound();

  const supabase = await createClient();
  const [open, done, feedback, users] = await Promise.all([
    supabase.rpc("admin_list_reports", { p_resolved: false }),
    supabase.rpc("admin_list_reports", { p_resolved: true }),
    supabase.rpc("admin_list_feedback"),
    supabase.rpc("admin_list_users"),
  ]);

  return (
    <AdminView
      openReports={(open.data ?? []) as ReportRow[]}
      doneReports={(done.data ?? []) as ReportRow[]}
      feedback={(feedback.data ?? []) as FeedbackRow[]}
      users={(users.data ?? []) as UserRow[]}
    />
  );
}
