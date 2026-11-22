import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("部屋に集まっている🍅の数は、オーナーでない人にも見える", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await signUp(a);
  await signUp(b);
  await a.goto("/rooms/new");
  await a.getByLabel("部屋名").fill(`トマトの部屋 ${Date.now()}`);
  await a.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(a).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = a.url();

  await b.goto(entryUrl);
  await b.getByLabel("今からやること").fill("英語");
  await b.getByRole("button", { name: "入室する" }).click();
  await expect(b.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(b.getByLabel("この部屋の🍅 0個")).toBeVisible();
});
