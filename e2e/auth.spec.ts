import { expect, test } from "@playwright/test";
import { uniqueUsername } from "./helpers";

test("新規登録 → ログアウト → ログインできる", async ({ page }) => {
  const username = uniqueUsername();
  const password = "mochi-password-123";

  await page.goto("/lobby");
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("tab", { name: "新規登録" }).click();
  await page.getByLabel("ユーザーID").fill(username);
  await page.getByLabel("表示名").fill("テストもち");
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "はじめる" }).click();

  await expect(page).toHaveURL(/\/lobby/);
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("ユーザーID").fill(username);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page).toHaveURL(/\/lobby/);
});

test("同じユーザーIDでは登録できない", async ({ page }) => {
  const username = uniqueUsername();
  for (const attempt of [1, 2]) {
    await page.goto("/login");
    await page.getByRole("tab", { name: "新規登録" }).click();
    await page.getByLabel("ユーザーID").fill(username);
    await page.getByLabel("パスワード").fill("mochi-password-123");
    await page.getByRole("button", { name: "はじめる" }).click();
    if (attempt === 1) {
      await expect(page).toHaveURL(/\/lobby/);
      await page.getByRole("button", { name: "ログアウト" }).click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      // Next.js のルートアナウンサーも role="alert" を持つので、文言で絞る
      await expect(page.getByRole("alert").filter({ hasText: "すでに使われています" })).toBeVisible();
    }
  }
});
