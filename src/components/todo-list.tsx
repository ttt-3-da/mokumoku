"use client";

import { Klee_One } from "next/font/google";
import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { inputClass } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { groupDoneByDay, jstDay, TODO_MAX_LENGTH, type Todo } from "@/lib/todo";

// 鉛筆で書いたような字（ToDo の紙の中だけ）
const pencilFont = Klee_One({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const dayLabel = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  weekday: "short",
});

/**
 * ToDoリスト。やることを書いておき、終わったらチェックする。チェックしたものは「これまでの記録」にずっと残る。
 * compact は自習室の中で使う小さい版（まだのものと、今日終わったものだけ）
 */
export function TodoList({ initial, compact = false }: { initial: Todo[]; compact?: boolean }) {
  const [todos, setTodos] = useState(initial);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // いまチェックしたものだけ、線を引くところを見せる（読みこんだときの記録は最初から線が引いてある）
  const [justChecked, setJustChecked] = useState<Set<string>>(new Set());

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
    if (done_at) setJustChecked((s) => new Set(s).add(t.id));
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
      <PencilGrain />
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
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="shrink-0 rounded-full bg-accent px-4 text-sm font-bold text-white hover:bg-accent-strong disabled:opacity-50"
        >
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
          <ul className={`todo-sheet rounded-md ${pencilFont.className}`}>
            {open.map((t) => (
              <TodoRow key={t.id} todo={t} onToggle={toggle} onRemove={remove} animate={false} />
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
                <ul className={`todo-sheet rounded-md ${pencilFont.className}`}>
                  {g.items.map((t) => (
                    <TodoRow key={t.id} todo={t} onToggle={toggle} animate={justChecked.has(t.id)} />
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

function TodoRow({ todo, onToggle, onRemove, animate }: { todo: Todo; onToggle: (t: Todo) => void; onRemove?: (t: Todo) => void; animate: boolean }) {
  const done = Boolean(todo.done_at);
  return (
    <li className="flex min-h-8 items-start gap-2 pr-2 pl-2.5 leading-8">
      {/* 鉛筆で描いた四角と、チェックの印 */}
      <span className="relative mt-2 h-4 w-4 shrink-0">
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(todo)}
          aria-label={`${todo.title}${done ? "（終わった）" : ""}`}
          className="peer absolute inset-0 m-0 h-4 w-4 cursor-pointer appearance-none rounded-[3px] border-[1.5px] border-[var(--graphite)] opacity-70 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
        />
        {done && (
          <svg viewBox="0 0 16 16" className="pointer-events-none absolute -top-1 -left-0.5 h-5 w-5 overflow-visible" aria-hidden>
            <path
              d="M2.5 8.5 C4 10, 5.5 11.5, 6.5 13 C8.5 9, 11 5, 15 1.5"
              fill="none"
              stroke="var(--graphite)"
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#pencil-grain)"
              pathLength={1}
              className={animate ? "pencil-draw" : undefined}
            />
          </svg>
        )}
      </span>
      <span className="ml-3 min-w-0 flex-1 text-[15px]">
        {/* 横線は字の長さだけ引く */}
        <span className="relative inline-block max-w-full break-words">
          <span className={done ? "opacity-55" : undefined}>{todo.title}</span>
          {done && (
            // 横線：少しゆれた鉛筆の線
            <svg
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              className={`pointer-events-none absolute inset-x-[-4px] top-1/2 h-2.5 w-[calc(100%+8px)] -translate-y-1/2 overflow-visible ${animate ? "pencil-wipe" : ""}`}
              aria-hidden
            >
              <path
                d="M0.5 5.8 C 15 4.6, 30 6.4, 48 5.2 S 80 4.4, 99.5 5.6"
                fill="none"
                stroke="var(--graphite)"
                strokeWidth="2.2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                filter="url(#pencil-grain)"
                strokeOpacity={0.85}
              />
            </svg>
          )}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(todo)}
          aria-label={`「${todo.title}」を消す`}
          className="shrink-0 rounded-full px-1.5 opacity-60 hover:bg-sakura/30 hover:opacity-100"
        >
          ×
        </button>
      )}
    </li>
  );
}

/** 鉛筆のざらっとした質感（線のふちを細かくゆらして、ところどころかすれさせる） */
function PencilGrain() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="pencil-grain" x="-5%" y="-50%" width="110%" height="200%">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" result="rough" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.8 1.3" result="speckle" />
        <feComposite in="rough" in2="speckle" operator="in" />
      </filter>
    </svg>
  );
}
