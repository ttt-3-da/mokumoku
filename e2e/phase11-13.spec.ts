import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("NGワードを含む部屋名では部屋を作れない", async ({ page }) => {
  await signUp(page, undefined, "えぬじーもち");
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill("死ね部屋");
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "使えない言葉" })).toHaveText("部屋名か説明文に使えない言葉が含まれています");
});

test("オーナーがキックすると、相手は記録画面へ移動する。テーマと統計も表示される", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  owner.on("dialog", (d) => void d.accept());

  // 宇宙テーマの部屋を作って入室
  await signUp(owner, undefined, "キックするもち");
  await owner.goto("/rooms/new");
  await owner.getByLabel("部屋名").fill(`宇宙部屋 ${Date.now()}`);
  await owner.locator('input[name="theme"][value="space"]').check({ force: true });
  await owner.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(owner).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = owner.url();
  await owner.getByLabel("今からやること").fill("見守り");
  await owner.getByRole("button", { name: "入室する" }).click();
  await expect(owner.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(owner.getByText(/🚀 宇宙・(朝|昼|夕方|夜)/)).toBeVisible();

  await signUp(guest, undefined, "キックされるもち");
  await guest.goto(entryUrl);
  await guest.getByLabel("今からやること").fill("勉強");
  await guest.getByRole("button", { name: "入室する" }).click();
  await expect(guest.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  // オーナーがゲストのもちを選んでキック
  await owner.getByRole("button", { name: /キックされるもち.*スタンプを送る相手に選ぶ/ }).click({ timeout: 15_000 });
  await owner.getByRole("button", { name: "キック", exact: true }).click();

  await expect(guest).toHaveURL(/\/sessions\/.+\/done\?removed=kick/, { timeout: 15_000 });
  await expect(guest.getByText("オーナーによって、この部屋から退室になりました。")).toBeVisible();
  await expect(owner.getByText("キックされるもち")).toHaveCount(0, { timeout: 10_000 });

  // プロフィールに統計が出る
  await owner.goto(`/lobby`);
  await owner.getByRole("link", { name: "プロフィール" }).click();
  await expect(owner.getByRole("heading", { name: "今週の学習時間" })).toBeVisible();
  await expect(owner.getByRole("heading", { name: "草カレンダー" })).toBeVisible();
});
