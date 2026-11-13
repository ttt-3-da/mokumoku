import type { Metadata } from "next";
import { FollowListPage } from "../follow-list-page";

export const metadata: Metadata = { title: "フォロー中" };

export default async function FollowingPage({ params }: PageProps<"/u/[username]/following">) {
  const { username } = await params;
  return <FollowListPage username={username} kind="following" />;
}
