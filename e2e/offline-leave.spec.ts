import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("電源が切れたときに退室になるまでの時間を、1〜30分から選べる", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
  const select = page.getByLabel("退室になるまでの時間");
  await expect(select).toHaveValue("5");
  await expect(select.locator("option")).toHaveText(["1分", "5分", "10分", "15分", "20分", "25分", "30分"]);
  await select.selectOption("20");
  const card = page.locator("form", { has: select });
  await card.getByRole("button", { name: "保存する" }).click();
  await expect(card.getByText("保存しました")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("退室になるまでの時間")).toHaveValue("20");
});
