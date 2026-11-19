import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("ポモドーロの部屋は、最初の1人が入った時点でタイマーが動いている", async ({ page }) => {
  await signUp(page, undefined, "ポモもち");
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill(`すぐ始まる部屋 ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  await page.getByLabel("今からやること").fill("英単語");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("タイマーはまだ始まっていません")).toHaveCount(0);
  await page.getByRole("button", { name: "⚙️ 設定" }).click();
  await expect(page.getByRole("button", { name: "最初からやり直す" })).toBeVisible();
});
