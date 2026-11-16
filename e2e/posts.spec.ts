import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { signUp, uniqueUsername } from "./helpers";

/**
 * 投稿できるのは1分以上の記録だけ。テストで1分待たないよう、
 * ローカルの Supabase で勉強を始めた時刻を30分前にずらす（キーはその場で supabase status から読む）
 */
async function backdateSession(sessionId: string) {
  const env = Object.fromEntries(
    execSync("npx supabase status -o env", { encoding: "utf8" })
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => [m[1], m[2]]),
  );
  const url = env.API_URL;
  if (!url || !/127\.0\.0\.1|localhost/.test(url)) throw new Error("ローカルの Supabase でだけ使える");
  const res = await fetch(`${url}/rest/v1/study_sessions?id=eq.${sessionId}`, {
    method: "PATCH",
    headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ started_at: new Date(Date.now() - 30 * 60_000).toISOString() }),
  });
  expect(res.ok).toBe(true);
}

async function studyOnce(page: Page, task: string) {
  await page.getByRole("link", { name: "＋ 部屋をつくる" }).click();
  await page.getByLabel("部屋名").fill(`投稿の部屋 ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill(task);
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "退室する" }).click();
  await expect(page).toHaveURL(/\/sessions\/.+\/done$/);
  const id = page.url().match(/\/sessions\/([^/]+)\/done/)![1];
  await backdateSession(id);
  await page.reload();
}

test("勉強の記録を投稿すると、ほかの人がもちスタンプで応援でき、お知らせが届く", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await signUp(a, uniqueUsername("pa"), "投稿するもち");
  await signUp(b, uniqueUsername("pb"), "応援するもち");

  // A：勉強して、ひとこと付きで投稿
  await studyOnce(a, "英単語");
  await a.getByLabel("📣 みんなに投稿する（任意）").fill("30分がんばった！");
  await a.getByRole("button", { name: "投稿する" }).click();
  await expect(a).toHaveURL(/\/feed$/);
  await expect(a.getByText("30分がんばった！")).toBeVisible();

  // B：フォローしていないので「フォロー中」には出ず、「みんな」に出る。スタンプを送る
  await b.goto("/feed");
  await expect(b.getByText("フォロー中の人の投稿はまだありません。")).toBeVisible();
  await b.goto("/feed?tab=all");
  const post = b.getByLabel("投稿するもち さんの投稿");
  await expect(post.getByText("30分がんばった！")).toBeVisible();
  // 送れるのは4つのもちスタンプだけ
  await expect(post.getByRole("button", { name: /を送る$/ })).toHaveCount(4);
  await post.getByRole("button", { name: "「ぱちぱち」を送る" }).click();
  await expect(post.getByRole("button", { name: "「ぱちぱち」を送る" })).toHaveAttribute("aria-pressed", "true");
  await b.reload();
  await expect(b.getByLabel("投稿するもち さんの投稿").getByRole("button", { name: "「ぱちぱち」を送る" })).toContainText("1");

  // A にお知らせが届く
  await a.goto("/notifications");
  await expect(a.getByText("に「ぱちぱち」を送りました")).toBeVisible();
});
