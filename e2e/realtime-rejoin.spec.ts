import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * 本番の Realtime は、ログインの期限が切れると部屋のチャンネルを閉じる（phx_close）。
 * 閉じられても自分から作り直して、ほかの人の画面から消えたままにならないこと。
 * テストでは、サーバーから phx_close が届いたことにする。
 */
test("部屋のつながりをサーバーに閉じられても、自分からつなぎ直す", async ({ page }) => {
  let roomJoins = 0;
  let inject: ((msg: string) => void) | null = null;
  let closeMsg: string | null = null;

  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => {
      server.send(m);
      const text = String(m);
      // v2（配列）と v1（オブジェクト）のどちらの形でも読む
      const parsed = JSON.parse(text) as unknown;
      const [joinRef, , topic, event] = Array.isArray(parsed)
        ? (parsed as [string, string, string, string])
        : [(parsed as { join_ref: string }).join_ref, null, (parsed as { topic: string }).topic, (parsed as { event: string }).event];
      if (event === "phx_join" && topic.startsWith("realtime:room:")) {
        roomJoins += 1;
        closeMsg = Array.isArray(parsed)
          ? JSON.stringify([joinRef, null, topic, "phx_close", {}])
          : JSON.stringify({ join_ref: joinRef, ref: null, topic, event: "phx_close", payload: {} });
      }
    });
    server.onMessage((m) => ws.send(m));
    inject = (msg) => ws.send(msg);
  });

  await signUp(page);
  await page.getByRole("link", { name: "＋ 部屋をつくる" }).click();
  await page.getByLabel("部屋名").fill(`つなぎ直す部屋 ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill("数学");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  expect(roomJoins).toBe(1);

  // サーバーに閉じられた
  inject!(closeMsg!);
  await expect.poll(() => roomJoins, { timeout: 10_000 }).toBe(2);
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
});
