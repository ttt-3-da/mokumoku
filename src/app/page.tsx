import { redirect } from "next/navigation";

// 未ログインなら proxy.ts が /login へ戻すので、ここに来るのはログイン済みユーザー
export default function Home() {
  redirect("/lobby");
}
