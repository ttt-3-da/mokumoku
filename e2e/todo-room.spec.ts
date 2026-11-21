import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("部屋の中でToDoを追加して、チェックをつけられる（PATCHを使わない）", async ({ page }) => {
  const patches: string[] = [];
  page.on("request", (r) => r.method() === "PATCH" && r.url().includes("/rest/v1/todos") && patches.push(r.url()));
  await signUp(page);
  await page.goto("/rooms/new");
  await page.getByLabel("部屋名").fill(`ToDoの部屋 ${Date.now()}`);
  await page.getByRole("button", { name: "部屋をつくる" }).click();
  await page.getByLabel("今からやること").fill("英語");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("● 接続中")).toBeVisible({ timeout: 15_000 });
  await page.getByText("✅ ToDo").click();
  await page.getByLabel("やることを追加").fill("英単語");
  await page.getByLabel("やることを追加").press("Enter");
  const saved = page.waitForResponse((r) => r.url().includes("/rpc/set_todo_done") && r.ok());
  await page.getByRole("checkbox", { name: "英単語" }).click();
  await saved;
  await expect(page.getByRole("checkbox", { name: "英単語（終わった）" })).toBeChecked();
  await page.reload();
  // まだのものがないと、ToDoの欄は閉じた状態で開く
  await page.getByText("✅ ToDo").click();
  await expect(page.getByRole("checkbox", { name: "英単語（終わった）" })).toBeChecked();
  await page.getByRole("checkbox", { name: "英単語（終わった）" }).click();
  await expect(page.getByRole("checkbox", { name: "英単語" })).not.toBeChecked();
  expect(patches).toEqual([]);
});
