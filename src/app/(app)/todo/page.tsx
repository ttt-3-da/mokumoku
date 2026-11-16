import type { Metadata } from "next";
import { TodoList } from "@/components/todo-list";
import { Card } from "@/components/ui";
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
        <p className="mt-1 text-xs text-ink-soft">やることを書いておいて、終わったらチェック。終わったことは「これまでの記録」にずっと残ります。自習室の中からもチェックできます。</p>
      </div>
      <Card>
        <TodoList initial={(data ?? []) as Todo[]} />
      </Card>
    </div>
  );
}
