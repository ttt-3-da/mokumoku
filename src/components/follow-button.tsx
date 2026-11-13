"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

/** フォローする・やめるボタン。押したらすぐ表示を切り替え、失敗したら元に戻す */
export function FollowButton({
  username,
  initialFollowing,
  followsMe = false,
  className = "",
}: {
  username: string;
  initialFollowing: boolean;
  followsMe?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().rpc(next ? "follow_user" : "unfollow_user", { p_username: username });
      if (error) {
        setFollowing(!next);
        setError(rpcErrorMessage(error));
        return;
      }
      router.refresh(); // フォロワー数などを取り直す
    });
  }

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <Button
        variant={following ? "secondary" : "primary"}
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className="px-4 py-1.5 text-sm"
      >
        {following ? "フォロー中" : followsMe ? "フォローし返す" : "フォローする"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
