import { expect, test } from "@playwright/test";
import { runLocalSql, signUp } from "./helpers";

test("部屋に集まっている🍅の数は、オーナーでない人にも見える", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await signUp(a);
  await signUp(b);
  await a.goto("/rooms/new");
  await a.getByLabel("部屋名").fill(`トマトの部屋 ${Date.now()}`);
  await a.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(a).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = a.url();

  await b.goto(entryUrl);
  await b.getByLabel("今からやること").fill("英語");
  await b.getByRole("button", { name: "入室する" }).click();
  await expect(b.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(b.getByLabel("この部屋の🍅 0個")).toBeVisible();
});

test("オーナーは部屋の上の「背景を買う」から、たまった🍅で背景を買って使える", async ({ page }) => {
  const name = `背景の部屋 ${Date.now()}`;
  await signUp(page);
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill(name);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill("数学");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  // まだ🍅がないので、買えずに「あと何個」が出る
  await page.getByRole("button", { name: /背景を買う/ }).click();
  const menu = page.getByRole("dialog", { name: "部屋の設定" });
  await expect(menu.getByRole("tab", { name: "🎨 背景" })).toHaveAttribute("aria-selected", "true");
  await expect(menu.getByText("🍅20・あと20個").first()).toBeVisible();
  await menu.getByRole("button", { name: "← 部屋に戻る" }).click();

  // この部屋で10時間勉強したことにする（🍅24個）
  runLocalSql(
    `update public.study_sessions set started_at = now() - interval '10 hours' where room_id = (select id from public.rooms where name = '${name}') and ended_at is null`,
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "この部屋の🍅 24個・🎨 背景を買う" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /背景を買う/ }).click();
  page.once("dialog", (d) => void d.accept());
  await menu.getByRole("button", { name: "「和室」を🍅20で買う" }).click();
  await menu.getByRole("button", { name: "「和室」にする" }).click();
  await expect(menu.getByText("使用中")).toBeVisible();
  await expect(menu.getByText("いまこの部屋の🍅 4 個")).toBeVisible();
});
