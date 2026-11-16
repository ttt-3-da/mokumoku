import { expect, test } from "@playwright/test";
import { skipTour, uniqueUsername } from "./helpers";

test("登録のあとに復活コードを作り、パスワードを忘れてもユーザーIDと復活コードで新しいパスワードにできる", async ({ page }) => {
  const username = uniqueUsername("rc");
  await page.goto("/login");
  await page.getByRole("tab", { name: "新規登録" }).click();
  await page.getByLabel("ユーザーID").fill(username);
  await page.getByLabel("パスワード").fill("mochi-password-123");
  await page.getByRole("button", { name: "はじめる" }).click();

  // 登録の直後に復活コードを作る
  await expect(page).toHaveURL(/\/recovery-code\?welcome=1/);
  await page.getByRole("button", { name: "🔑 復活コードを作る" }).click();
  const code = (await page.getByLabel("復活コード").textContent())!.trim();
  expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  await page.getByRole("link", { name: "保存したので、はじめる →" }).click();
  await skipTour(page);
  // 作ったのでロビーのおすすめは出ない
  await expect(page.getByText("復活コードを作っておこう")).toHaveCount(0);
  await page.getByRole("button", { name: "アカウントのメニュー" }).click();
  await page.getByRole("button", { name: "ログアウト" }).click();

  // パスワードを忘れた
  await page.getByRole("link", { name: "パスワードを忘れた？" }).click();
  await expect(page).toHaveURL(/\/reset$/);
  await page.getByLabel("ユーザーID").fill(username);
  await page.getByLabel("復活コード").fill("ZZZZ-ZZZZ-ZZZZ");
  await page.getByLabel("新しいパスワード", { exact: true }).fill("new-mochi-pass-456");
  await page.getByLabel("新しいパスワード（確認）").fill("new-mochi-pass-456");
  await page.getByRole("button", { name: "パスワードを変える" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ユーザーIDか復活コードが違います" })).toBeVisible();

  // 小文字・ハイフンなしでも通る
  await page.getByLabel("復活コード").fill(code.replace(/-/g, "").toLowerCase());
  await page.getByLabel("新しいパスワード", { exact: true }).fill("new-mochi-pass-456");
  await page.getByLabel("新しいパスワード（確認）").fill("new-mochi-pass-456");
  await page.getByRole("button", { name: "パスワードを変える" }).click();
  await expect(page.getByText("✅ パスワードを変えました")).toBeVisible();
  const newCode = (await page.getByLabel("復活コード").textContent())!.trim();
  expect(newCode).not.toBe(code);
  await page.getByRole("link", { name: "保存したので、ロビーへ →" }).click();
  await expect(page).toHaveURL(/\/lobby/);

  // 新しいパスワードでログインできる
  await page.getByRole("button", { name: "アカウントのメニュー" }).click();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.getByLabel("ユーザーID").fill(username);
  await page.getByLabel("パスワード").fill("new-mochi-pass-456");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page).toHaveURL(/\/lobby/);
});
