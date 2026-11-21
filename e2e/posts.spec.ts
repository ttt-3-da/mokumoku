import { expect, test, type Page } from "@playwright/test";
import { backdateSession, makeAdmin, signUp, uniqueUsername } from "./helpers";

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
  // 前に動かしたテストの投稿と区別できるよう、表示名に毎回ちがう印を付ける
  const tag = Date.now().toString(36).slice(-4);
  const author = `投稿するもち${tag}`;
  await signUp(a, uniqueUsername("pa"), author);
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
  const post = b.getByLabel(`${author} さんの投稿`);
  await expect(post.getByText("30分がんばった！")).toBeVisible();
  // 送れるのは4つのもちスタンプだけ
  await expect(post.getByRole("button", { name: /を送る$/ })).toHaveCount(4);
  await post.getByRole("button", { name: "「ぱちぱち」を送る" }).click();
  await expect(post.getByRole("button", { name: "「ぱちぱち」を送る" })).toHaveAttribute("aria-pressed", "true");
  await b.reload();
  await expect(b.getByLabel(`${author} さんの投稿`).getByRole("button", { name: "「ぱちぱち」を送る" })).toContainText("1");

  // A にお知らせが届く
  await a.goto("/notifications");
  await expect(a.getByText("に「ぱちぱち」を送りました")).toBeVisible();
});

test("運営は投稿に「運営が確認しました」の印をつけられ、投稿した人にお知らせが届く", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const admin = await (await browser.newContext()).newPage();
  const tag = Date.now().toString(36).slice(-4);
  const author = `見てほしいもち${tag}`;
  const adminName = uniqueUsername("pk");
  await signUp(a, uniqueUsername("pc"), author);
  await signUp(admin, adminName, "運営もち");
  await makeAdmin(adminName);

  await studyOnce(a, "数学");
  await a.getByLabel("📣 みんなに投稿する（任意）").fill(`運営さん見てください ${tag}`);
  await a.getByRole("button", { name: "投稿する" }).click();
  await expect(a).toHaveURL(/\/feed$/);
  // ふつうの人には印をつけるボタンが出ない
  await expect(a.getByRole("button", { name: "✅ 確認しましたをつける" })).toHaveCount(0);

  await admin.goto("/feed?tab=all");
  const post = admin.getByLabel(`${author} さんの投稿`);
  await post.getByRole("button", { name: "✅ 確認しましたをつける" }).click();
  await expect(post.getByText("✅ 運営が確認しました")).toBeVisible();

  // みんなに見える
  await a.reload();
  await expect(a.getByLabel(`${author} さんの投稿`).getByText("✅ 運営が確認しました")).toBeVisible();
  await a.goto("/notifications");
  await expect(a.getByText("運営が、あなたの投稿を確認しました")).toBeVisible();
});
