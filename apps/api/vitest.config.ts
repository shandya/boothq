import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // Integration tests share one Postgres test database and truncate
    // tables between tests, so test files must not run concurrently.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
