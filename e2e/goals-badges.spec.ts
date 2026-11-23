import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("スマホの縦持ちでは ☰ から左にメニューが出る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page);
  const menu = page.getByRole("dialog", { name: "メニュー" });
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(menu).toBeInViewport();
  await menu.getByRole("link", { name: "記録" }).click();
  await expect(page).toHaveURL(/\/timeline/);
  await expect(menu).not.toBeInViewport();
  await expect(page.getByRole("heading", { name: "ふり返り" })).toBeVisible();

  // 先週・先月にさかのぼれる
  await page.getByRole("tab", { name: "今週" }).click();
  await expect(page.getByRole("button", { name: "次の期間" })).toBeDisabled();
  await page.getByRole("button", { name: "前の期間" }).click();
  await expect(page.getByText("先週", { exact: true })).toBeVisible();
  await expect(page.getByText("合計", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "今月" }).click();
  await page.getByRole("button", { name: "前の期間" }).click();
  await expect(page.getByText("先月", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "次の期間" }).click();
  await expect(page.getByRole("button", { name: "次の期間" })).toBeDisabled();
});

test("週の目標・ダークモード・バッジ", async ({ page }) => {
  const username = await signUp(page);
  await expect(page.getByRole("link", { name: "週の目標を決める" })).toBeVisible();

  await page.goto("/settings");
  await page.getByLabel("1週間の勉強時間").fill("10");
  await page.getByLabel("1週間の勉強時間").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "保存しました" })).toBeVisible();

  await page.getByText("ダーク", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto("/lobby");
  await expect(page.getByRole("progressbar", { name: "今週の目標の進み具合" })).toBeVisible();
  await expect(page.getByText("0分 / 10時間")).toBeVisible();

  // 部屋を作ると「部屋づくり」バッジ
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill("バッジの部屋");
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}/);
  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: /実績バッジ/ })).toContainText("1 /");
  await expect(page.getByText("部屋づくり")).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByText("実績バッジ「部屋づくり」を手に入れました")).toBeVisible();
});
