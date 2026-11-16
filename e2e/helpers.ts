import { expect, type Page } from "@playwright/test";

export function uniqueUsername(prefix = "e2e"): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 20);
}

/** UI から新規登録してログイン状態にする */
export async function signUp(page: Page, username = uniqueUsername(), displayName = "テストもち") {
  await page.goto("/login");
  await page.getByRole("tab", { name: "新規登録" }).click();
  await page.getByLabel("ユーザーID").fill(username);
  await page.getByLabel("表示名").fill(displayName);
  await page.getByLabel("パスワード").fill("mochi-password-123");
  await page.getByRole("button", { name: "はじめる" }).click();
  // 登録の直後は復活コードの画面。作らずに先へ進む（作る流れは recovery-code.spec.ts）
  await expect(page).toHaveURL(/\/recovery-code/);
  await page.getByRole("link", { name: "保存したので、はじめる →" }).click();
  await expect(page).toHaveURL(/\/lobby/);
  await skipTour(page);
  return username;
}

/** 新規登録の直後に出る使い方の案内を閉じる */
export async function skipTour(page: Page) {
  await page.getByRole("dialog", { name: "ようこそ、Mokumoku へ！" }).getByRole("button", { name: "とばす" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
