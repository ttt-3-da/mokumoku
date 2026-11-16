import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("もちを着せかえて保存できる。解放していないアイテムは選べない", async ({ page }) => {
  await signUp(page, undefined, "着せかえもち");
  await page.goto("/avatar");

  await expect(page.getByRole("button", { name: /葉っぱ/ })).toBeDisabled();
  await page.getByRole("button", { name: "よもぎ", exact: true }).click();
  await page.getByRole("button", { name: "この見た目にする" }).click();
  await expect(page.getByRole("status")).toHaveText("保存しました！");

  await page.reload();
  await expect(page.getByRole("button", { name: "よもぎ", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("限定部屋に招待URLから入り、スタンプを送ると相手のもちが跳ねる", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  // A：限定・自由モードの部屋を作る
  await signUp(a, undefined, "招待するもち");
  await a.goto("/rooms/new");
  await a.getByLabel("部屋名").fill(`招待部屋 ${Date.now()}`);
  await a.locator('input[name="visibility"][value="unlisted"]').check({ force: true });
  await a.locator('input[name="timer_mode"][value="free"]').check({ force: true });
  await a.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(a).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);

  // オーナーには招待リンクが、https:// からまるごと見える
  const inviteUrl = (await a.getByRole("link", { name: "招待リンク" }).textContent())!.trim();
  expect(inviteUrl).toMatch(/^https?:\/\/[^/]+\/r\/[\w-]+$/);
  const invitePath = new URL(inviteUrl).pathname;

  await a.getByLabel("今からやること").fill("招待を待つ");
  await a.getByRole("button", { name: "入室する" }).click();
  await expect(a.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  // 部屋の中の上にも「🔗 招待リンク」のボタンがある
  await expect(a.getByRole("button", { name: "🔗 招待リンク" })).toBeVisible();

  // B：招待URLを開くと入室前画面に直接来る
  await signUp(b, undefined, "招待されたもち");
  await b.goto(invitePath);
  await expect(b).toHaveURL(/\/rooms\/[0-9a-f-]{36}\?invite=/);
  await b.getByLabel("今からやること").fill("招待で来た");
  await b.getByRole("button", { name: "入室する" }).click();
  await expect(b.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(a.getByText("招待されたもち")).toBeVisible({ timeout: 15_000 });

  // B → A にスタンプ
  await b.getByRole("button", { name: /招待するもち.*スタンプを送る相手に選ぶ/ }).click();
  await b.getByRole("button", { name: "ぱちぱち スタンプを送る" }).click();
  // 2秒以内の連打はできない
  await expect(b.getByRole("button", { name: "ぱちぱち スタンプを送る" })).toBeDisabled();

  // A の画面で、A のもちにハートが出る（受け取った側がぴょんと跳ねる）
  await expect(a.locator(".mochi-hop .mochi-heart")).toHaveCount(1, { timeout: 10_000 });
});

test("自由モードのストップウォッチは、同じ部屋のほかの人にも見える", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  await signUp(a, undefined, "はかるもち");
  await a.goto("/rooms/new");
  await a.getByLabel("部屋名").fill(`自由部屋 ${Date.now()}`);
  await a.locator('input[name="timer_mode"][value="free"]').check({ force: true });
  await a.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(a).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = a.url();
  await a.getByLabel("今からやること").fill("計測");
  await a.getByRole("button", { name: "入室する" }).click();
  await expect(a.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  await signUp(b, undefined, "みるもち");
  await b.goto(entryUrl);
  await b.getByLabel("今からやること").fill("見学");
  await b.getByRole("button", { name: "入室する" }).click();
  await expect(b.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  await a.getByRole("button", { name: "開始" }).click();
  await expect(a.getByRole("button", { name: "停止" })).toBeVisible();
  // B の画面で、A の席にストップウォッチ（計測中）が出る
  await expect(b.getByLabel(/ストップウォッチ .*（計測中）/)).toBeVisible({ timeout: 10_000 });

  await a.getByRole("button", { name: "停止" }).click();
  await expect(b.getByLabel(/ストップウォッチ .*（停止中）/)).toBeVisible({ timeout: 10_000 });
  await expect(a.getByRole("button", { name: "再開" })).toBeVisible();
});

test("同じブラウザの別タブで別のユーザーにログインすると、部屋の画面は止まる", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  await signUp(first, undefined, "さいしょのもち");
  await first.goto("/rooms/new");
  await first.getByLabel("部屋名").fill(`切替 ${Date.now()}`);
  await first.getByRole("button", { name: "部屋をつくる" }).click();
  await first.getByLabel("今からやること").fill("勉強");
  await first.getByRole("button", { name: "入室する" }).click();
  await expect(first.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  // 同じブラウザ（Cookie 共有）の別タブでログアウト → 別ユーザーで登録
  const second = await context.newPage();
  await second.goto("/lobby");
  await second.getByRole("button", { name: "アカウントのメニュー" }).click();
  await second.getByRole("button", { name: "ログアウト" }).click();
  await expect(second).toHaveURL(/\/login/);
  await signUp(second, undefined, "ふたりめのもち");

  // 元のタブに戻ると、別のユーザーとして操作しないよう止まる
  await first.bringToFront();
  await first.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(first.getByText("別のユーザーにログインし直されました")).toBeVisible({ timeout: 10_000 });
});