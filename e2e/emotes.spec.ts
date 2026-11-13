import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("エモートをすると、同じ部屋のほかの人の画面でももちが動く", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  await signUp(a, undefined, "みているもち");
  await a.goto("/rooms/new");
  await a.getByLabel("部屋名").fill(`エモート部屋 ${Date.now()}`);
  await a.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(a).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = a.url();
  await a.getByLabel("今からやること").fill("見る");
  await a.getByRole("button", { name: "入室する" }).click();
  await expect(a.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  await signUp(b, undefined, "うごくもち");
  await b.goto(entryUrl);
  await b.getByLabel("今からやること").fill("動く");
  await b.getByRole("button", { name: "入室する" }).click();
  await expect(b.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(a.getByText("うごくもち")).toBeVisible({ timeout: 15_000 });

  // ポモドーロの部屋（タイマー前）でもエモートは使える
  await b.getByRole("button", { name: "🎭 エモート" }).click();
  await b.getByRole("button", { name: "よろしく" }).click();

  // A の画面：B の席に吹き出しが出て、もちが手を振る
  await expect(a.getByRole("status").filter({ hasText: "👋 よろしく" })).toBeVisible({ timeout: 10_000 });
  await expect(a.locator(".mochi-emote-wave")).toHaveCount(1);
  // 送った本人の画面でも動く。3秒以内の連打はできない
  await expect(b.locator(".mochi-emote-wave")).toHaveCount(1);
  await expect(b.getByRole("button", { name: "ありがとう" })).toBeDisabled();

  // ミュートは押すと切り替わり、再読み込みしても覚えている
  await b.getByRole("button", { name: /音あり/ }).click();
  await expect(b.getByRole("button", { name: /ミュート中/ })).toHaveAttribute("aria-pressed", "true");
  await b.reload();
  await expect(b.getByRole("button", { name: /ミュート中/ })).toBeVisible({ timeout: 15_000 });
});
