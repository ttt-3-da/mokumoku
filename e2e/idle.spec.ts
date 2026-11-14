import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("部屋で30分操作がないと「まだ勉強中？」と聞かれ、続けると閉じる", async ({ page }) => {
  await page.clock.install();
  await signUp(page, undefined, "ねむいもち");
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill(`操作なし ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill("読書");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  const dialog = page.getByRole("alertdialog", { name: "まだ勉強中？" });
  await page.clock.fastForward("29:00");
  await expect(dialog).toHaveCount(0);
  await page.clock.fastForward("01:05");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("後に自動で退室");

  await dialog.getByRole("button", { name: "続ける" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/live$/);
});
