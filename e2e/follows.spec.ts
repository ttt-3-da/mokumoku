import { expect, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./helpers";

test("フォローすると通知が届き、相手が勉強中ならロビーに出る", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const aName = uniqueUsername("fa");

  await signUp(a, aName, "フォローされるもち");
  await signUp(b, undefined, "フォローするもち");

  // B が A をフォロー
  await b.goto(`/u/${aName}`);
  await b.getByRole("button", { name: "フォローする" }).click();
  await expect(b.getByRole("button", { name: "フォロー中" })).toBeVisible();
  await expect(b.getByRole("link", { name: /1 フォロワー/ })).toBeVisible();

  // A に通知が届く → フォローし返す
  await a.goto("/lobby");
  await expect(a.getByRole("link", { name: "お知らせ（未読1件）" })).toBeVisible();
  await a.getByRole("link", { name: /お知らせ/ }).click();
  await expect(a.getByText("さんがあなたをフォローしました")).toBeVisible();
  await a.getByRole("button", { name: "フォローし返す" }).click();
  await expect(a.getByRole("button", { name: "フォロー中" })).toBeVisible();
  await expect(a.getByRole("link", { name: "お知らせ" })).toBeVisible(); // 既読になって数が消える

  // A が公開部屋で勉強を始めると、B のロビーに「いま勉強中」で出る
  const roomName = `フォロー部屋 ${Date.now()}`;
  await a.goto("/rooms/new");
  await a.getByLabel("部屋名").fill(roomName);
  await a.getByRole("button", { name: "部屋をつくる" }).click();
  await a.getByLabel("今からやること").fill("英単語");
  await a.getByRole("button", { name: "入室する" }).click();
  await expect(a.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  await b.goto("/lobby");
  const now = b.getByRole("region", { name: "いま勉強中のフォロー中の人" });
  await expect(now.getByText("フォローされるもち")).toBeVisible();
  await expect(now.getByText(roomName)).toBeVisible();

  // くらべる：自分とフォロー中の人が並ぶ
  await b.getByRole("link", { name: "くらべる →" }).click();
  await expect(b.getByRole("heading", { name: "今週の学習時間をくらべる" })).toBeVisible();
  const board = b.locator("ol");
  await expect(board.getByRole("listitem").filter({ hasText: "フォローされるもち" })).toBeVisible();
  await expect(board.getByRole("listitem").filter({ hasText: "（あなた）" })).toBeVisible();
});
