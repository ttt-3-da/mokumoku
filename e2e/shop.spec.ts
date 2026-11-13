import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("登録ボーナスのコインで色を買って、着られる。足りない品物は買えない", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await signUp(page, undefined, "おかいものもち");

  // 登録すると30コイン
  await expect(page.getByRole("link", { name: "所持コイン 30枚（ショップへ）" })).toBeVisible();
  await page.getByRole("link", { name: /所持コイン/ }).click();
  await expect(page).toHaveURL(/\/shop/);

  // レインボー（150）は足りない
  await page.getByRole("button", { name: /レインボー/ }).click();
  await expect(page.getByRole("button", { name: "🪙150 で買う" })).toBeDisabled();
  await expect(page.getByText("あと 🪙120 で買えます")).toBeVisible();

  // ミント（20）を買って着る
  await page.getByRole("button", { name: /ミント/ }).click();
  await page.getByRole("button", { name: "🪙20 で買う" }).click();
  await expect(page.getByRole("status").filter({ hasText: "「ミント」を買いました！" })).toBeVisible();
  await expect(page.getByLabel("所持コイン 10枚")).toBeVisible();
  await page.getByRole("button", { name: "これを着る" }).click();
  await expect(page.getByRole("status").filter({ hasText: "着がえました！" })).toBeVisible();

  // 着せかえ画面では、買った色と無料の色だけ選べる
  await page.goto("/avatar");
  await expect(page.getByRole("button", { name: "ミント", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "レインボー", exact: true })).toHaveCount(0);

  // 履歴に残る
  await page.goto("/coins");
  await expect(page.getByText("「ミント」を買った")).toBeVisible();
  await expect(page.getByText("登録ボーナス")).toBeVisible();
});
