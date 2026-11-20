import { expect, test, type Page } from "@playwright/test";
import { runLocalSql, signUp, uniqueUsername } from "./helpers";

async function enterNewRoom(page: Page, name: string) {
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill(name);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const entryUrl = page.url();
  await page.getByLabel("今からやること").fill("調べもの");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await settle(page);
  return entryUrl;
}

/** 開いて5秒後のハートビート（再読み込みの知らせを取り消すためのもの）が済むのを待つ */
async function settle(page: Page) {
  await page.waitForTimeout(6_000);
}

/** 次の定期の回を待たずにハートビートを送らせる */
async function beatNow(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("mokumoku:beat-now")));
}

const sessionOf = (username: string) =>
  `(select s.id from public.study_sessions s join public.profiles p on p.id = s.user_id where p.username = '${username}' and s.ended_at is null)`;

test("自動で退室になっても、画面に戻ると同じ部屋に入り直せる", async ({ page }) => {
  const name = uniqueUsername("aw");
  await signUp(page, name, "もどるもち");
  await enterNewRoom(page, `入り直す部屋 ${Date.now()}`);

  // ハートビートが止まって3分たった、ことにして後処理を動かす
  runLocalSql(`update public.study_sessions set last_seen_at = now() - interval '5 minutes' where id = ${sessionOf(name)}`);
  runLocalSql("select public.cleanup_stale_sessions()");

  await beatNow(page);
  await expect(page.getByText("しばらく画面から離れていたので、入り直しました。")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/live$/);
});

test("タブが見えないまま15分たった人は離席中に見え、戻ると記録を区切って続きを始める", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const bName = uniqueUsername("ab");
  await signUp(a, undefined, "みるもち");
  await signUp(b, bName, "はなれもち");
  const entryUrl = await enterNewRoom(a, `離席の部屋 ${Date.now()}`);
  await b.goto(entryUrl);
  await b.getByLabel("今からやること").fill("英語");
  await b.getByRole("button", { name: "入室する" }).click();
  await expect(b.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await settle(b);

  // b は20分前からタブが見えていない、ことにする
  runLocalSql(`update public.study_sessions set hidden_since = now() - interval '20 minutes' where id = ${sessionOf(bName)}`);
  await a.reload();
  await expect(a.getByLabel(/はなれもち（離席中）/)).toBeVisible({ timeout: 15_000 });

  // b が戻ってくる：記録が区切られて、同じ部屋で続きが始まる
  await beatNow(b);
  await expect(b.getByText("15分以上ほかの画面にいたので、記録をそこで区切って、続きを始めました。")).toBeVisible({ timeout: 15_000 });
  await expect(b).toHaveURL(/\/live$/);
  await a.reload();
  await expect(a.getByLabel(/はなれもち（集中中）/)).toBeVisible({ timeout: 15_000 });
});
