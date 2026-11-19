import { expect, test } from "@playwright/test";

test("タブのアイコンはもち（ログイン前でも出る）", async ({ page, request }) => {
  await page.goto("/login");
  const href = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(href).toMatch(/\/icon\.png/);
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});
