import { PrismaClient } from "@prisma/client";

// Serverless functions can hot-reload the module without restarting the
// process; caching the client on `globalThis` avoids exhausting Postgres
// connections by creating a new PrismaClient on every reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
