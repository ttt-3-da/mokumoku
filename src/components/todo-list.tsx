"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { inputClass } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { groupDoneByDay, jstDay, TODO_MAX_LENGTH, type Todo } from "@/lib/todo";

const dayLabel = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" });

/**
 * ToDoリスト。やることを書いておき、終わったらチェックする。チェックしたものは「これまでの記録」にずっと残る。
 * compact は自習室の中で使う小さい版（まだのものと、今日終わったものだけ）
 */
export function TodoList({ initial, compact = false }: { initial: Todo[]; compact?: boolean }) {
  const [todos, setTodos] = useState(initial);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const today = jstDay(new Date().toISOString());
  const open = useMemo(() => todos.filter((t) => !t.done_at).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)), [todos]);
  const groups = useMemo(() => groupDoneByDay(todos), [todos]);
  const doneToday = groups.find((g) => g.day === today)?.items ?? [];
  const totalDone = todos.length - open.length;

  function add(e: FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const { data, error } = await createClient().from("todos").insert({ title: text }).select("id, title, done_at, created_at").single();
      if (error || !data) {
        setError(rpcErrorMessage(error));
        return;
      }
      setTodos((list) => [...list, data as Todo]);
      setTitle("");
    });
  }

  function toggle(t: Todo) {
    const done_at = t.done_at ? null : new Date().toISOString();
    setTodos((list) => list.map((x) => (x.id === t.id ? { ...x, done_at } : x)));
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().from("todos").update({ done_at }).eq("id", t.id);
      if (error) {
        setTodos((list) => list.map((x) => (x.id === t.id ? t : x)));
        setError(rpcErrorMessage(error));
      }
    });
  }

  function remove(t: Todo) {
    setTodos((list) => list.filter((x) => x.id !== t.id));
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().from("todos").delete().eq("id", t.id);
      if (error) {
        setTodos((list) => [...list, t]);
        setError(rpcErrorMessage(error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor={compact ? "todo-new-room" : "todo-new"} className="sr-only">
          やることを追加
        </label>
        <input
          id={compact ? "todo-new-room" : "todo-new"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TODO_MAX_LENGTH}
          placeholder="例：英単語を30個おぼえる"
          className={`${inputClass} ${compact ? "py-1.5 text-sm" : ""}`}
        />
        <button type="submit" disabled={pending || !title.trim()} className="shrink-0 rounded-full bg-accent px-4 text-sm font-bold text-white hover:bg-accent-strong disabled:opacity-50">
          追加
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <section aria-label="やること" className="flex flex-col gap-1.5">
        {!compact && <h2 className="font-bold">やること（{open.length}）</h2>}
        {open.length === 0 ? (
          <p className="text-sm text-ink-soft">{totalDone > 0 ? "ぜんぶ終わりました！🎉" : "やることを書いておくと、終わったときにチェックできます。"}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {open.map((t) => (
              <TodoRow key={t.id} todo={t} onToggle={toggle} onRemove={remove} />
            ))}
          </ul>
        )}
      </section>

      {compact ? (
        <p className="text-xs text-ink-soft">
          今日終わったこと：{doneToday.length}個
          <Link href="/todo" className="ml-2 underline">
            これまでの記録
          </Link>
        </p>
      ) : (
        <section aria-label="これまでの記録" className="flex flex-col gap-3">
          <h2 className="font-bold">
            これまでの記録 <span className="text-sm font-normal text-ink-soft">（終わったこと {totalDone}個）</span>
          </h2>
          {groups.length === 0 ? (
            <p className="text-sm text-ink-soft">終わったことは、ここに日ごとにずっと残ります。</p>
          ) : (
            groups.map((g) => (
              <div key={g.day}>
                <h3 className="mb-1 text-sm font-bold text-ink-soft">
                  {g.day === today ? "今日" : dayLabel.format(new Date(`${g.day}T12:00:00+09:00`))}（{g.items.length}個）
                </h3>
                <ul className="flex flex-col gap-1">
                  {g.items.map((t) => (
                    <TodoRow key={t.id} todo={t} onToggle={toggle} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}

function TodoRow({ todo, onToggle, onRemove }: { todo: Todo; onToggle: (t: Todo) => void; onRemove?: (t: Todo) => void }) {
  const done = Boolean(todo.done_at);
  return (
    <li className="flex items-center gap-2 rounded-2xl bg-cream/60 px-3 py-1.5">
      <input type="checkbox" checked={done} onChange={() => onToggle(todo)} aria-label={`${todo.title}${done ? "（終わった）" : ""}`} className="h-4 w-4 shrink-0 accent-accent" />
      <span className={`min-w-0 flex-1 break-words text-sm ${done ? "text-ink-soft line-through" : ""}`}>{todo.title}</span>
      {onRemove && (
        <button type="button" onClick={() => onRemove(todo)} aria-label={`「${todo.title}」を消す`} className="shrink-0 rounded-full px-1.5 text-ink-soft hover:bg-sakura/30">
          ×
        </button>
      )}
    </li>
  );
}
