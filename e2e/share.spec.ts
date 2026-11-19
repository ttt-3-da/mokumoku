import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { backdateSession, signUp } from "./helpers";

test("勉強の記録を X でシェアすると、ログインしていない人も記録カードを見られ、シェアをやめると見えなくなる", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // X の投稿画面は開かない（開こうとした URL だけ確かめる）
  let intent: URL | null = null;
  await context.route(/^https:\/\/x\.com\//, (route) => {
    intent = new URL(route.request().url());
    return route.fulfill({ status: 200, body: "ok" });
  });

  await signUp(page, undefined, "シェアするもち");
  await page.getByRole("link", { name: "＋ 部屋をつくる" }).click();
  await page.getByLabel("部屋名").fill(`シェアの部屋 ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill("ひみつの課題");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "退室する" }).click();
  await expect(page).toHaveURL(/\/sessions\/.+\/done$/);
  const id = page.url().match(/\/sessions\/([^/]+)\/done/)![1];
  await backdateSession(id);
  await page.reload();

  // シェアする前は、ログインしていない人には見えない
  const guest = await (await browser.newContext()).newPage();
  const before = await guest.goto(`/s/${id}`);
  expect(before?.status()).toBe(404);

  const popup = context.waitForEvent("page");
  await page.getByRole("link", { name: "𝕏 でシェア" }).click();
  await (await popup).waitForLoadState();
  expect(intent!.searchParams.get("text")).toMatch(/(29|30)分勉強しました/);
  expect(intent!.searchParams.get("url")).toMatch(new RegExp(`/s/${id}$`));
  await expect(page.getByRole("button", { name: "シェアをやめる" })).toBeVisible();

  // ログインしていない人が記録カードを見る。やったことは出ない
  await expect.poll(async () => (await guest.goto(`/s/${id}`))?.status(), { timeout: 10_000 }).toBe(200);
  await expect(guest.getByText("シェアするもち さんは")).toBeVisible();
  await expect(guest.getByText(/^(29|30)分$/)).toBeVisible();
  await expect(guest.getByText("ひみつの課題")).toHaveCount(0);
  const image = await guest.request.get(`/s/${id}/opengraph-image`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  // 見た目を確かめられるよう、テストの結果に残す
  await test.info().attach("記録カード", { body: await image.body(), contentType: "image/png" });
  await writeFile(test.info().outputPath("card.png"), await image.body());

  // シェアをやめる
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "シェアをやめる" }).click();
  await expect(page.getByRole("button", { name: "シェアをやめる" })).toHaveCount(0);
  expect((await guest.goto(`/s/${id}`))?.status()).toBe(404);
});
