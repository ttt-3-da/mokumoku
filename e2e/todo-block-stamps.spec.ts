import { expect, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./helpers";

test("ToDo：1枚の紙に書きたしていき、チェックしたものも紙に残る", async ({ page }) => {
  await signUp(page, undefined, "やることもち");
  await page.goto("/todo");
  await page.getByLabel("やることを追加").fill("英単語を30個");
  await page.getByRole("button", { name: "追加" }).click();
  await page.getByLabel("やることを追加").fill("数学の宿題");
  await page.getByRole("button", { name: "追加" }).click();
  await page.getByRole("checkbox", { name: "英単語を30個" }).check();

  // 1枚の紙に、終わったものも線を引いたまま残る
  const sheet = page.getByRole("region", { name: "ToDoの紙" });
  await expect(sheet.getByText("今日")).toBeVisible();
  await expect(page.getByText("まだ 1個・終わったこと 1個")).toBeVisible();

  // 読みこみ直しても残っている
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "英単語を30個（終わった）" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "数学の宿題" })).not.toBeChecked();
});

test("遊びに行った部屋にスタンプを置くとお知らせが届き、ブロックすると部屋に行けなくなる", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  a.on("dialog", (d) => void d.accept());
  const aName = uniqueUsername("sa");
  const bName = uniqueUsername("sb");
  await signUp(a, aName, "部屋のもち");
  await signUp(b, bName, "あそびにきたもち");

  // B が A の部屋にスタンプを置く
  await b.goto(`/u/${aName}`);
  await b.getByRole("link", { name: "🏡 もちの部屋に遊びに行く" }).click();
  await b.getByRole("button", { name: "ぱちぱち スタンプを置く" }).click();
  await expect(b.getByText("スタンプを置きました！")).toBeVisible();

  // A にお知らせが届き、部屋にスタンプが残っている
  await a.goto("/notifications");
  await expect(a.getByText("にスタンプを置いていきました")).toBeVisible();
  await a.goto("/mochi");
  await expect(a.getByRole("button", { name: "あそびにきたもち さんの「ぱちぱち」" })).toBeVisible();

  // A が B をブロック → B は A の部屋もプロフィールも見られない
  await a.goto(`/u/${bName}`);
  await a.getByRole("button", { name: "🚫 ブロック" }).click();
  await expect(a.getByText("ブロック中")).toBeVisible();
  await b.goto(`/u/${aName}/mochi`);
  await expect(b.getByRole("button", { name: "ぱちぱち スタンプを置く" })).toHaveCount(0);

  // 設定から解除できる
  await a.goto("/settings");
  await a.getByRole("button", { name: "ブロックを解除" }).click();
  await a.reload();
  await expect(a.getByText("いません。", { exact: true })).toBeVisible();
});
