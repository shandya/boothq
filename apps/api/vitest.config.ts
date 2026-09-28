import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Excludes compiled test files a stray `pnpm build` leaves in dist/
    // from being picked up and re-run as duplicates.
    exclude: ["**/node_modules/**", "**/dist/**"],
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // Integration tests share one Postgres test database and truncate
    // tables between tests, so test files must not run concurrently.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
