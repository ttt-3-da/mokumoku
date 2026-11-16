/** ToDoリストの1行（public.todos） */
export type Todo = { id: string; title: string; done_at: string | null; created_at: string };

export const TODO_MAX_LENGTH = 100;

const dayFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDay(iso: string): string {
  const parts = dayFmt.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 終わったものを、終わった日（日本時間）ごとにまとめる。新しい日が先、同じ日の中は終わった順 */
export function groupDoneByDay(todos: Todo[]): { day: string; items: Todo[] }[] {
  const map = new Map<string, Todo[]>();
  for (const t of todos) {
    if (!t.done_at) continue;
    const d = jstDay(t.done_at);
    map.set(d, [...(map.get(d) ?? []), t]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, items]) => ({ day, items: items.sort((a, b) => (a.done_at! < b.done_at! ? -1 : 1)) }));
}

/** 自習室に出す「終わったもの」はこの時刻より後（ここ2日） */
export function recentDoneSince(now = Date.now()): string {
  return new Date(now - 2 * 86400_000).toISOString();
}
