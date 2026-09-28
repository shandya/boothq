import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Excludes compiled test files a stray `pnpm build` leaves in dist/
    // from being picked up and re-run as duplicates.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
