import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./helpers";

/** ローカルの Supabase で、開いているセッションの leaving_at を読む（キーはその場で supabase status から読む） */
async function openSession(username: string) {
  const env = Object.fromEntries(
    execSync("npx supabase status -o env", { encoding: "utf8" })
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => [m[1], m[2]]),
  );
  const url = env.API_URL;
  if (!url || !/127\.0\.0\.1|localhost/.test(url)) throw new Error("ローカルの Supabase でだけ使える");
  const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` };
  const res = await fetch(
    `${url}/rest/v1/study_sessions?select=leaving_at,profiles!inner(username)&ended_at=is.null&profiles.username=eq.${username}`,
    { headers },
  );
  const rows = (await res.json()) as { leaving_at: string | null }[];
  return rows[0];
}

test("退室ボタンを押さずにタブを閉じると「出ていった」が届き、再読み込みなら取り消される", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const username = uniqueUsername("lv");
  await signUp(page, username, "閉じるもち");
  await page.getByRole("link", { name: "＋ 部屋をつくる" }).click();
  await page.getByLabel("部屋名").fill(`閉じる部屋 ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill("英語");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  // 再読み込み：いったん「出ていった」が届くが、開き直したハートビートで取り消される
  await page.reload();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await openSession(username))?.leaving_at, { timeout: 10_000 }).toBeNull();

  // タブを閉じる
  await page.close({ runBeforeUnload: true });
  await expect.poll(async () => (await openSession(username))?.leaving_at, { timeout: 10_000 }).not.toBeNull();
  await context.close();
});
