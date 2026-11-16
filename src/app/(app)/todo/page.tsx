import type { Metadata } from "next";
import { TodoList } from "@/components/todo-list";
import { createClient, requireProfile } from "@/lib/supabase/server";
import type { Todo } from "@/lib/todo";

export const metadata: Metadata = { title: "ToDo" };

export default async function TodoPage() {
  await requireProfile();
  const supabase = await createClient();
  // 終わったものもぜんぶ読む（これまでの記録）
  const { data } = await supabase.from("todos").select("id, title, done_at, created_at").order("created_at").limit(5000);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">ToDo</h1>
        <p className="mt-1 text-xs text-ink-soft">長い紙に、やることをどんどん書きたしていこう。終わったら鉛筆で線を引いて、紙にずっと残ります。自習室の中からも書けます。</p>
      </div>
      <TodoList initial={(data ?? []) as Todo[]} />
    </div>
  );
}
