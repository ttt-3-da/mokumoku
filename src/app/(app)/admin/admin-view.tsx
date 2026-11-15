"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdminActions } from "@/components/admin-actions";
import { Card } from "@/components/ui";
import { feedbackKindLabel } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/client";

export type ReportRow = {
  target_type: "room" | "user" | "post";
  target_id: string;
  label: string;
  link: string;
  reasons: string[];
  reporters: string[];
  report_count: number;
  last_reported_at: string;
  resolved_at: string | null;
};

export type FeedbackRow = {
  id: string;
  kind: string;
  body: string;
  page: string;
  created_at: string;
  read_at: string | null;
  username: string | null;
  display_name: string | null;
};

export type UserRow = {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  is_admin: boolean;
  is_public: boolean;
  suspended_at: string | null;
  last_country: string | null;
  last_seen_at: string | null;
  total_minutes: number;
  rooms_owned: number;
};

const TABS = { open: "通報（未対応）", done: "通報（対応済み）", feedback: "フィードバック", users: "ユーザー" } as const;
type Tab = keyof typeof TABS;

const TARGET_LABEL = { room: "部屋", user: "ユーザー", post: "投稿" } as const;

function when(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 管理の画面：通報の一覧と対応、フィードバックを読む */
export function AdminView({
  openReports,
  doneReports,
  feedback,
  users,
}: {
  openReports: ReportRow[];
  doneReports: ReportRow[];
  feedback: FeedbackRow[];
  users: UserRow[];
}) {
  const [tab, setTab] = useState<Tab>("open");
  const unread = feedback.filter((f) => !f.read_at).length;
  const counts: Record<Tab, number> = { open: openReports.length, done: doneReports.length, feedback: unread, users: 0 };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">管理</h1>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="管理の種類">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-sm ${tab === t ? "bg-ink font-bold text-paper" : "bg-paper hover:bg-sakura/20"}`}
          >
            {TABS[t]}
            {t !== "done" && counts[t] > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[11px] text-white">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <UserList items={users} />
      ) : tab === "feedback" ? (
        <FeedbackList items={feedback} />
      ) : (
        <ReportList items={tab === "open" ? openReports : doneReports} resolved={tab === "done"} />
      )}
    </div>
  );
}

function ReportList({ items, resolved }: { items: ReportRow[]; resolved: boolean }) {
  if (items.length === 0) return <p className="text-sm text-ink-soft">{resolved ? "対応済みの通報はありません。" : "未対応の通報はありません。"}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => (
        <li key={`${r.target_type}-${r.target_id}`}>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded-full bg-cream px-2 text-xs">{TARGET_LABEL[r.target_type]}</span>
              {r.link ? (
                <Link href={r.link} className="font-bold hover:underline">
                  {r.label}
                </Link>
              ) : (
                <b>{r.label}</b>
              )}
              <span className="ml-auto text-xs text-ink-soft">
                {r.report_count}件・最後は {when(r.last_reported_at)}
              </span>
            </div>
            <ul className="flex flex-col gap-0.5 text-sm">
              {r.reasons.map((reason, i) => (
                <li key={i} className="text-ink-soft">
                  ・{reason}（@{r.reporters[i]}）
                </li>
              ))}
            </ul>
            <AdminActions actions={reportActions(r, resolved)} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

function reportActions(r: ReportRow, resolved: boolean) {
  const list = [];
  if (!resolved) {
    list.push({ label: "対応済みにする", confirm: "この通報を対応済みにしますか？", rpc: "admin_resolve_reports", args: { p_target_type: r.target_type, p_target_id: r.target_id } });
  }
  if (r.target_type === "room") {
    list.push({ label: "名前と説明を消す", confirm: "この部屋の名前と説明を消しますか？", rpc: "admin_clear_room_text", args: { p_room_id: r.target_id } });
    list.push({ label: "部屋を削除", confirm: "この部屋を削除しますか？在室中の人は退室になり、元に戻せません。", rpc: "admin_delete_room", args: { p_room_id: r.target_id }, danger: true });
  }
  if (r.target_type === "user") {
    list.push({ label: "名前と自己紹介を消す", confirm: "このユーザーの表示名と自己紹介を消しますか？", rpc: "admin_clear_user_text", args: { p_user_id: r.target_id } });
    list.push({ label: "利用停止", confirm: "このユーザーを利用停止にしますか？（あとで解除できます）", rpc: "admin_set_suspended", args: { p_user_id: r.target_id, p_suspended: true }, danger: true });
  }
  return list;
}

function FeedbackList({ items }: { items: FeedbackRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return <p className="text-sm text-ink-soft">まだフィードバックはありません。</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((f) => (
        <li key={f.id}>
          <Card className={`flex flex-col gap-2 ${f.read_at ? "opacity-70" : "border-2 border-accent/50"}`}>
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="rounded-full bg-cream px-2 text-xs">{feedbackKindLabel(f.kind)}</span>
              {f.username ? (
                <Link href={`/u/${f.username}`} className="font-bold hover:underline">
                  {f.display_name}（@{f.username}）
                </Link>
              ) : (
                <b>（退会した人）</b>
              )}
              <span className="ml-auto text-xs text-ink-soft">{when(f.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{f.body}</p>
            {f.page && <p className="truncate text-xs text-ink-soft">送る前のページ：{f.page}</p>}
            {!f.read_at && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await createClient().rpc("admin_mark_feedback_read", { p_id: f.id });
                    router.refresh();
                  })
                }
                className="self-start rounded-full bg-paper px-3 py-1 text-xs font-bold shadow-sm hover:bg-sakura/20 disabled:opacity-50"
              >
                読んだ
              </button>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function minutesText(m: number) {
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}時間${m % 60}分` : `${m}分`;
}

/** 登録しているユーザー全員（新しい順）。名前・ユーザーIDでしぼりこめる */
function UserList({ items }: { items: UserRow[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = query ? items.filter((u) => u.username.includes(query) || u.display_name.toLowerCase().includes(query)) : items;
  const suspended = items.filter((u) => u.suspended_at).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          登録しているユーザー <b className="tabular-nums">{items.length}</b> 人
          {suspended > 0 && <span className="ml-2 text-ink-soft">（利用停止 {suspended} 人）</span>}
        </p>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・ユーザーIDでさがす"
          aria-label="ユーザーをさがす"
          className="ml-auto w-full rounded-full border border-line bg-paper px-4 py-1.5 text-sm sm:w-64"
        />
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-ink-soft">見つかりませんでした。</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper">
          {shown.map((u) => (
            <li key={u.id}>
              <Link href={`/u/${u.username}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-cream">
                <span className="font-bold">{u.display_name || "（名前なし）"}</span>
                <span className="text-ink-soft">@{u.username}</span>
                {u.is_admin && <span className="rounded-full bg-accent/15 px-2 text-xs text-accent-strong">管理者</span>}
                {u.suspended_at && <span className="rounded-full bg-red-100 px-2 text-xs text-red-700">利用停止</span>}
                {!u.is_public && <span className="rounded-full bg-cream px-2 text-xs text-ink-soft">非公開</span>}
                <span className="ml-auto flex flex-wrap gap-x-3 text-xs text-ink-soft tabular-nums">
                  <span>勉強 {minutesText(u.total_minutes)}</span>
                  <span>部屋 {u.rooms_owned}</span>
                  <span>国 {u.last_country ?? "—"}</span>
                  <span>登録 {when(u.created_at)}</span>
                  <span>最後 {u.last_seen_at ? when(u.last_seen_at) : "—"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
