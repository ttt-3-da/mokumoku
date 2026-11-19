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

test("管理者がフィードバックに返信すると、送った人のお知らせと意見箱に返信が出る", async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  const user = await (await browser.newContext()).newPage();
  const adminName = uniqueUsername("ra");
  await signUp(admin, adminName, "返すもち");
  await makeAdmin(adminName);
  await signUp(user, uniqueUsername("ru"), "送るもち");

  const body = `ダークモードがほしい ${Date.now()}`;
  await user.goto("/feedback");
  await user.locator("#feedback-body").fill(body);
  await user.getByRole("button", { name: "送る", exact: true }).click();
  await expect(user.getByText("送りました。ありがとうございます！")).toBeVisible();
  await expect(user.getByRole("region", { name: "あなたが送ったもの" })).toContainText("まだ返信はありません");

  const reply = `ありがとうございます、検討します ${Date.now()}`;
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "フィードバック" }).click();
  const card = admin.getByRole("listitem").filter({ hasText: body });
  await card.getByRole("button", { name: "↩️ 返信する" }).click();
  await card.getByLabel("返信の文").fill(reply);
  await card.getByRole("button", { name: "返信を送る" }).click();
  await expect(card).toContainText("返信しました");

  await user.goto("/notifications");
  const item = user.getByRole("listitem").filter({ hasText: reply });
  await expect(item).toContainText("あなたのフィードバックへの返信");
  await item.getByRole("link", { name: "送った内容を見る" }).click();
  await expect(user).toHaveURL(/\/feedback$/);
  await expect(user.getByRole("region", { name: "あなたが送ったもの" })).toContainText(reply);
});

test("管理者は「人を選ぶ」で、選んだ人にだけお知らせを送れる", async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  const picked = await (await browser.newContext()).newPage();
  const notPicked = await (await browser.newContext()).newPage();
  const adminName = uniqueUsername("pa");
  const pickedName = uniqueUsername("pp");
  await signUp(admin, adminName, "選ぶもち");
  await makeAdmin(adminName);
  await signUp(picked, pickedName, "選ばれもち");
  await signUp(notPicked, undefined, "見てるもち");

  const message = `あなたにだけ聞きたいです ${Date.now()}`;
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "フィードバック" }).click();
  await admin.getByLabel("お知らせの文").fill(message);
  await admin.getByLabel("人を選ぶ").check();
  await admin.getByLabel("送る人をさがす").fill(pickedName);
  await admin.getByRole("checkbox", { name: /選ばれもち/ }).check();
  await expect(admin.getByText("1人を選んでいます")).toBeVisible();
  admin.once("dialog", (d) => {
    expect(d.message()).toContain("「人を選ぶ」の 1人");
    void d.accept();
  });
  await admin.getByRole("button", { name: "お知らせを送る" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "1人に送りました" })).toBeVisible();

  await picked.goto("/notifications");
  await expect(picked.getByRole("listitem").filter({ hasText: message })).toBeVisible();
  await notPicked.goto("/notifications");
  await expect(notPicked.getByText(message)).toHaveCount(0);
});
