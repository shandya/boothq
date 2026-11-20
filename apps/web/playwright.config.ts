import { defineConfig, devices } from "@playwright/test";

// Runs the whole stack on its own ports against the test database
// (apps/api/.env.test: see .env.test.example) so it never touches dev data
// and doesn't collide with `pnpm dev`. The PINs there must be 111111
// (Admin) and 222222 (Illustrator), same as the API integration tests.
const WEB_PORT = 3100;
const API_PORT = 4100;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    ...devices["iPhone SE"], // 375px wide, the design baseline (CLAUDE.md rule 7)
    defaultBrowserType: "chromium",
    trace: "off",
  },
  webServer: [
    {
      command: "pnpm exec tsx --env-file=.env.test src/server.ts",
      cwd: "../api",
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), PUBLIC_WEB_URL: WEB_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec next dev -p ${WEB_PORT}`,
      url: `${WEB_URL}/login`,
      env: { API_URL: `http://localhost:${API_PORT}`, NEXT_PUBLIC_BOOTH_NAME: "E2E Booth" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
