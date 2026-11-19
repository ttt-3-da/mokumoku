import { expect, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./helpers";

test("プロフィールの項目をワンタップで自分だけにすると、ほかの人には出ない", async ({ browser }) => {
  const me = await (await browser.newContext()).newPage();
  const other = await (await browser.newContext()).newPage();
  const name = uniqueUsername("ps");
  await signUp(me, name, "かくすもち");
  await signUp(other, undefined, "みるもち");

  await me.goto(`/u/${name}`);
  const grass = me.getByRole("switch", { name: "草カレンダーをみんなに見せる" });
  await expect(grass).toHaveAttribute("aria-checked", "true");
  await grass.click();
  await expect(grass).toHaveAttribute("aria-checked", "false");
  await expect(grass).toHaveText("🙈 自分だけ");
  // 本人には見えたまま
  await expect(me.getByRole("heading", { name: "草カレンダー" })).toBeVisible();

  await other.goto(`/u/${name}`);
  await expect(other.getByRole("heading", { name: "今週の学習時間" })).toBeVisible();
  await expect(other.getByRole("heading", { name: "草カレンダー" })).toHaveCount(0);
  await expect(other.getByRole("switch")).toHaveCount(0);

  // 戻すと、ほかの人にも見える
  await me.reload();
  await me.getByRole("switch", { name: "草カレンダーをみんなに見せる" }).click();
  await expect(me.getByRole("switch", { name: "草カレンダーをみんなに見せる" })).toHaveAttribute("aria-checked", "true");
  await other.reload();
  await expect(other.getByRole("heading", { name: "草カレンダー" })).toBeVisible();
});
