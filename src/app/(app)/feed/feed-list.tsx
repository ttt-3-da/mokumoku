"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Mochi } from "@/components/mochi";
import { ReportButton } from "@/components/report-button";
import { StampArt } from "@/components/stamp-art";
import { Card } from "@/components/ui";
import type { Avatar } from "@/lib/avatar";
import { rpcErrorMessage } from "@/lib/errors";
import { formatMinutes } from "@/lib/pomodoro";
import { POST_STAMPS, postStampLabel, toggleReaction, type FeedTab, type Post, type PostStampId } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";

const timeFormat = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function FeedList({ tab, initial, pageSize, myAvatar }: { tab: FeedTab; initial: Post[]; pageSize: number; myAvatar: Avatar }) {
  const [posts, setPosts] = useState(initial);
  const [hasMore, setHasMore] = useState(initial.length >= pageSize);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    const last = posts.at(-1);
    if (!last) return;
    startTransition(async () => {
      const { data, error } = await createClient().rpc("list_posts", { p_tab: tab, p_before: last.created_at, p_limit: pageSize });
      if (error) return setError(rpcErrorMessage(error));
      const more = (data ?? []) as Post[];
      setPosts((list) => [...list, ...more]);
      setHasMore(more.length >= pageSize);
    });
  }

  function react(post: Post, stamp: PostStampId) {
    const on = !post.reactions.some((r) => r.stamp_id === stamp && r.reacted);
    const update = (value: boolean) =>
      setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, reactions: toggleReaction(p.reactions, stamp, value) } : p)));
    update(on);
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().rpc("toggle_post_reaction", { p_post_id: post.id, p_stamp_id: stamp });
      if (error) {
        update(!on);
        setError(rpcErrorMessage(error));
      }
    });
  }

  function remove(post: Post) {
    if (!window.confirm("この投稿を消しますか？（記録そのものは消えません）")) return;
    setPosts((list) => list.filter((p) => p.id !== post.id));
    startTransition(async () => {
      const { error } = await createClient().rpc("delete_post", { p_post_id: post.id });
      if (error) setError(rpcErrorMessage(error));
    });
  }

  if (posts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 text-center text-sm text-ink-soft">
        <Mochi avatar={myAvatar} size={72} seed="feed-empty" />
        {tab === "following" ? (
          <p>
            フォロー中の人の投稿はまだありません。
            <Link href="/feed?tab=all" className="ml-1 font-bold underline">
              みんなの投稿を見る
            </Link>
          </p>
        ) : (
          <p>まだ投稿はありません。勉強して、最初の投稿をしてみよう！</p>
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id}>
            <PostCard post={p} myAvatar={myAvatar} onReact={react} onRemove={remove} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <button type="button" onClick={loadMore} disabled={pending} className="self-center rounded-full px-4 py-1.5 text-sm text-ink-soft hover:bg-paper">
          {pending ? "読み込み中…" : "もっと見る"}
        </button>
      )}
    </div>
  );
}

function PostCard({
  post,
  myAvatar,
  onReact,
  onRemove,
}: {
  post: Post;
  myAvatar: Avatar;
  onReact: (p: Post, s: PostStampId) => void;
  onRemove: (p: Post) => void;
}) {
  return (
    <Card className="flex flex-col gap-3" aria-label={`${post.display_name} さんの投稿`}>
      <div className="flex items-start gap-3">
        <Link href={`/u/${post.username}`} className="shrink-0">
          <Mochi avatar={post.avatar} size={48} seed={post.username} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/u/${post.username}`} className="font-bold hover:underline">
              {post.display_name}
            </Link>
            <span className="text-xs text-ink-soft">@{post.username}</span>
            <span className="ml-auto text-xs text-ink-soft">{timeFormat.format(new Date(post.created_at))}</span>
          </p>
          <p className="mt-1 text-sm">
            <b className="text-lg">{formatMinutes(post.minutes)}</b> 勉強した
            {post.task && <span className="ml-1 break-words">・{post.task}</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
            {post.room_name && (
              <span>
                {post.room_icon} {post.room_name}
              </span>
            )}
            {post.pomodoros > 0 && <span>🍅 {post.pomodoros}回</span>}
            {post.todos_done > 0 && <span>✅ ToDoを{post.todos_done}個おわらせた</span>}
          </p>
          {post.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{post.body}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {POST_STAMPS.map((s) => {
          const r = post.reactions.find((x) => x.stamp_id === s);
          const label = postStampLabel(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onReact(post, s)}
              aria-pressed={Boolean(r?.reacted)}
              aria-label={`「${label}」を送る`}
              title={label}
              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-bold tabular-nums transition hover:scale-105 ${
                r?.reacted ? "border-accent bg-sakura/30" : "border-line bg-cream"
              }`}
            >
              <StampArt id={s} avatar={myAvatar} size={28} />
              {r && r.count > 0 && <span>{r.count}</span>}
            </button>
          );
        })}
        <span className="ml-auto">
          {post.mine ? (
            <button type="button" onClick={() => onRemove(post)} className="text-xs text-ink-soft hover:text-red-700 hover:underline">
              投稿を消す
            </button>
          ) : (
            <ReportButton targetType="post" targetId={post.id} />
          )}
        </span>
      </div>
    </Card>
  );
}
