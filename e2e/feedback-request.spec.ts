import { expect, test } from "@playwright/test";
import { makeAdmin, signUp, uniqueUsername } from "./helpers";

test("管理者が「フィードバックを送ってみませんか？」を送ると、お知らせに届き、押すと意見箱が開く", async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  const user = await (await browser.newContext()).newPage();
  const adminName = uniqueUsername("fa");
  await signUp(admin, adminName, "運営もち");
  await makeAdmin(adminName);
  await signUp(user, uniqueUsername("fu"), "使うもち");

  const message = `使ってみた感想を教えてください ${Date.now()}`;
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "フィードバック" }).click();
  await admin.getByLabel("お知らせの文").fill(message);
  await admin.getByLabel("全員").check();
  admin.once("dialog", (d) => {
    expect(d.message()).toMatch(/「全員」の \d+人 のお知らせに送ります/);
    void d.accept();
  });
  await admin.getByRole("button", { name: "お知らせを送る" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "人に送りました" })).toBeVisible();

  // 受け取った人：お知らせに出て、押すと意見箱が開く
  await user.goto("/notifications");
  const item = user.getByRole("listitem").filter({ hasText: message });
  await expect(item).toContainText("運営より");
  await item.getByRole("link", { name: "✉️ 意見箱を開く" }).click();
  await expect(user).toHaveURL(/\/feedback$/);
});
