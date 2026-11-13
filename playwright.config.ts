import { defineConfig, devices } from "@playwright/test";

/**
 * E2E テストはローカルの Supabase（`npx supabase start`）に対して実行する。
 * 事前に .env.local を用意しておくこと。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // 2つのブラウザで登録・入室するテストは、並列実行中だと30秒（初期値）を超えることがある
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // next dev は初回アクセス時にページをコンパイルするため、並列実行すると時間切れになりやすい。
  // CI と同じく本番ビルドに対して実行する（開発中の localhost:3000 とぶつからないよう 3100 番を使う）
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
