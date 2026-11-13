import type { Metadata } from "next";
import { FollowListPage } from "../follow-list-page";

export const metadata: Metadata = { title: "フォロワー" };

export default async function FollowersPage({ params }: PageProps<"/u/[username]/followers">) {
  const { username } = await params;
  return <FollowListPage username={username} kind="followers" />;
}
