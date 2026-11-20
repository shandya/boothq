import { execSync } from "node:child_process";
import { resolve } from "node:path";

// Migrates and empties the test database before every run.
export default function globalSetup(): void {
  const apiDir = resolve(process.cwd(), "../api") // pnpm e2e runs from apps/web;
  process.loadEnvFile(resolve(apiDir, ".env.test"));
  execSync("pnpm exec prisma migrate deploy", { cwd: apiDir, stdio: "inherit", env: process.env });
  execSync("pnpm exec tsx scripts/reset-e2e-db.ts", { cwd: apiDir, stdio: "inherit", env: process.env });
}
