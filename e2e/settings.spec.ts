import { expect, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./helpers";

test("自己紹介を書いて検索で見つかる。非公開にすると見えなくなる", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const name = uniqueUsername("set");

  await signUp(a, name, "せっていもち");
  await a.getByRole("button", { name: "アカウントのメニュー" }).click();
  await a.getByRole("link", { name: "設定" }).click();
  await a.getByLabel("自己紹介").fill("朝の1時間で資格の勉強をしています。");
  await a.getByRole("button", { name: "保存する" }).first().click();
  await expect(a.getByRole("status").filter({ hasText: "保存しました" })).toBeVisible();

  // ほかの人：検索で見つかり、自己紹介が読める
  await signUp(b, undefined, "さがすもち");
  await b.goto(`/users?q=${name}`);
  await b.getByRole("link", { name: /せっていもち/ }).click();
  await expect(b.getByText("朝の1時間で資格の勉強をしています。")).toBeVisible();

  // 非公開にすると、検索にも出ずプロフィールも開けない
  await a.getByLabel("プロフィールを公開する").uncheck();
  await a.getByRole("button", { name: "保存する" }).nth(2).click(); // プロフィール・週の目標・公開範囲 の順
  await expect(a.getByRole("status").filter({ hasText: "保存しました" }).nth(1)).toBeVisible();

  await b.goto(`/users?q=${name}`);
  await expect(b.getByText("見つかりませんでした")).toBeVisible();
  await b.goto(`/u/${name}`);
  await expect(b.getByRole("heading", { name: "このプロフィールは見られません" })).toBeVisible();
});

test("パスワードを変えると、新しいパスワードでログインできる", async ({ page }) => {
  const name = await signUp(page, undefined, "ぱすもち");
  await page.goto("/settings");
  await page.getByLabel("今のパスワード").fill("mochi-password-123");
  await page.getByLabel("新しいパスワード", { exact: true }).fill("new-mochi-pass-456");
  await page.getByLabel("新しいパスワード（確認）").fill("new-mochi-pass-456");
  await page.getByRole("button", { name: "変更する" }).click();
  await expect(page.getByRole("status").filter({ hasText: "パスワードを変更しました" })).toBeVisible();

  await page.getByRole("button", { name: "アカウントのメニュー" }).click();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("ユーザーID").fill(name);
  await page.getByLabel("パスワード").fill("new-mochi-pass-456");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/lobby/);
});

test("退会すると、ログイン画面に戻り、同じユーザーIDではもうログインできない", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  const name = await signUp(page, undefined, "たいかいもち");
  await page.goto("/settings");
  await page.getByRole("button", { name: "退会の手続きへ" }).click();
  await page.getByLabel(/確認のため/).fill(name);
  await page.locator("#delete_password").fill("mochi-password-123");
  await page.getByRole("button", { name: "退会する" }).click();

  await expect(page).toHaveURL(/\/login\?deleted=1/);
  await expect(page.getByText("退会しました")).toBeVisible();
  await page.getByLabel("ユーザーID").fill(name);
  await page.getByLabel("パスワード").fill("mochi-password-123");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ユーザーIDまたはパスワードが違います" })).toBeVisible();
});

test("オーナーはあとから部屋の情報を変えられ、削除すると、いた人は記録画面へ移動し、部屋は開けなくなる", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  owner.on("dialog", (d) => void d.accept());

  await signUp(owner, undefined, "けすもち");
  await owner.goto("/rooms/new");
  await owner.getByLabel("部屋名").fill(`消す部屋 ${Date.now()}`);
  await owner.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(owner).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = owner.url();
  await owner.getByLabel("今からやること").fill("片付け");
  await owner.getByRole("button", { name: "入室する" }).click();
  await expect(owner.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  await signUp(guest, undefined, "いたもち");
  await guest.goto(entryUrl);
  await guest.getByLabel("今からやること").fill("勉強");
  await guest.getByRole("button", { name: "入室する" }).click();
  await expect(guest.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect(owner.getByText("いたもち")).toBeVisible({ timeout: 15_000 });

  await owner.getByRole("button", { name: "⚙️ 設定" }).click();
  // 部屋の情報をあとから変える
  const settings = owner.getByRole("dialog", { name: "部屋の設定" });
  const newName = `変えた部屋 ${Date.now()}`;
  await settings.getByLabel("部屋名").fill(newName);
  await settings.getByLabel("説明").fill("名前を変えました");
  await settings.getByLabel("タグ").fill("英語 朝活");
  await settings.getByRole("button", { name: "🌙" }).click();
  await settings.getByRole("button", { name: "部屋の情報を保存" }).click();
  await expect(settings.getByRole("status").filter({ hasText: "部屋の情報を保存しました" })).toBeVisible();
  await expect(owner.getByRole("heading", { level: 1, name: newName })).toBeVisible();

  // 削除は、押すと何が起きるかが出て、もう一度押して消す
  await settings.getByRole("button", { name: "部屋を削除する…" }).click();
  await expect(settings.getByText("元に戻せません")).toBeVisible();
  await settings.getByRole("button", { name: "削除する", exact: true }).click();

  await expect(owner).toHaveURL(/removed=deleted-by-me/, { timeout: 15_000 });
  await expect(guest).toHaveURL(/removed=deleted/, { timeout: 15_000 });
  await expect(guest.getByText("オーナーがこの部屋を削除したため")).toBeVisible();

  await guest.goto(entryUrl);
  await expect(guest.getByText(/404|見つかりません|This page could not be found/).first()).toBeVisible();
});

test("オーナーは入室する前の画面からも部屋の情報を変えたり、部屋を削除したりでき、消すとロビーに戻る", async ({ page }) => {
  await signUp(page, undefined, "まえけすもち");
  const name = `入る前に消す部屋 ${Date.now()}`;
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill(name);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = page.url();

  await page.getByText("✏️ 部屋の名前・説明・タグを変える").click();
  const renamed = `入る前に変えた部屋 ${Date.now()}`;
  await page.getByLabel("部屋名").fill(renamed);
  await page.getByRole("button", { name: "部屋の情報を保存" }).click();
  await expect(page.getByRole("status").filter({ hasText: "部屋の情報を保存しました" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();

  const del = page.getByRole("region", { name: "部屋の削除" });
  await del.getByRole("button", { name: "部屋を削除する…" }).click();
  await expect(del.getByText("元に戻せません")).toBeVisible();
  await del.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page).toHaveURL(/\/lobby/);

  await page.goto(entryUrl);
  await expect(page.getByText(/404|見つかりません|This page could not be found/).first()).toBeVisible();
});
