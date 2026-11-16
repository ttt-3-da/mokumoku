import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

// 集中中にもちが持つペン・ハチマキの結び目が、もちの枠の外（右上）に飛んでいかないこと
test("集中中のもちのペンとハチマキが、もちの中に描かれる", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: "＋ 部屋をつくる" }).click();
  await page.getByLabel("部屋名").fill(`ペンの部屋 ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill("数学");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });

  const pen = page.locator(".mochi-pen rect").first();
  await expect(pen).toBeVisible();
  const outside = await pen.evaluate((el) => {
    const svg = el.closest("svg")!.getBoundingClientRect();
    const parts = [el, ...el.closest("svg")!.querySelectorAll("ellipse.mp-fixed")];
    return parts
      .map((p) => p.getBoundingClientRect())
      .filter((r) => r.left < svg.left - 1 || r.right > svg.right + 1 || r.top < svg.top - 1 || r.bottom > svg.bottom + 1).length;
  });
  expect(outside).toBe(0);
});
