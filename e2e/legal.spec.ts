import { expect, test } from "@playwright/test";

test("ログインしていなくても、利用規約とプライバシーポリシーが読める", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "利用規約" }).first().click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
  await page.getByRole("link", { name: "プライバシーポリシー" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "1. 集める情報" })).toBeVisible();
});
