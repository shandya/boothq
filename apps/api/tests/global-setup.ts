import { execSync } from "node:child_process";

// Runs once before the whole test run: points Prisma at boothq_test (see
// docker/init-test-db.sql) and applies any pending migrations to it.
export default function setup(): void {
  process.loadEnvFile(".env.test");
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env: process.env });
}
