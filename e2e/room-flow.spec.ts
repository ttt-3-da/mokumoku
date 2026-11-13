import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("部屋を作って入室 → 退室 → 記録画面まで進める", async ({ page }) => {
  await signUp(page, undefined, "部屋主もち");

  await page.getByRole("link", { name: "＋ 部屋をつくる" }).click();
  const roomName = `E2E部屋 ${Date.now()}`;
  await page.getByLabel("部屋名").fill(roomName);
  await page.getByLabel("タグ").fill("テスト E2E");
  await page.getByRole("button", { name: "部屋をつくる" }).click();

  // 入室前画面
  await expect(page.getByRole("heading", { name: roomName })).toBeVisible();
  await expect(page.getByText("まだだれもいません")).toBeVisible();
  await page.getByLabel("今からやること").fill("E2Eテストを書く");
  await page.getByRole("button", { name: "入室する" }).click();

  // 部屋の中：Presence で自分が表示される
  await expect(page).toHaveURL(/\/live$/);
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("部屋主もち")).toBeVisible();
  await expect(page.getByText("E2Eテストを書く").first()).toBeVisible();

  // 退室 → 記録画面（1分未満なので投稿はできない）
  await page.getByRole("button", { name: "退室する" }).click();
  await expect(page).toHaveURL(/\/sessions\/.+\/done$/);
  await expect(page.getByRole("heading", { name: "おつかれさま！" })).toBeVisible();
  await expect(page.getByText("1分未満だったので、記録には残りません。")).toBeVisible();

  // 記録は自分だけのもの。1分未満なのでまだ何もない
  await page.getByRole("link", { name: "記録" }).click();
  await expect(page.getByRole("heading", { name: "記録" })).toBeVisible();
  await expect(page.getByText("まだ記録がありません。自習室で")).toBeVisible();

  // ロビーの「公開中の部屋」に出ている
  await page.goto("/lobby");
  await expect(page.getByRole("link", { name: new RegExp(roomName) }).first()).toBeVisible();
});

test("2人目が入室すると、1人目の画面にリアルタイムで表示される", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  await signUp(a, undefined, "もちA");
  await a.goto("/rooms/new");
  await a.getByLabel("部屋名").fill(`同時入室 ${Date.now()}`);
  await a.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(a).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = a.url();
  await a.getByLabel("今からやること").fill("数学");
  await a.getByRole("button", { name: "入室する" }).click();
  await expect(a.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  await signUp(b, undefined, "もちB");
  await b.goto(entryUrl);
  await expect(b.getByText("もちA")).toBeVisible(); // 入室前でも在室者が見える
  await b.getByLabel("今からやること").fill("英語");
  await b.getByRole("button", { name: "入室する" }).click();

  await expect(a.getByText("もちB")).toBeVisible({ timeout: 15_000 });
  await expect(a.getByText("英語")).toBeVisible();
});
