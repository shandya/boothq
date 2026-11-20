// Puts the e2e database in the state a fresh booth starts from: no Days or
// tickets, and one ACTIVE Event (a Day can't be opened without one).
// Run by apps/web/e2e/global-setup.ts with .env.test loaded; never point it
// at a real database.
import { prisma } from "../src/lib/prisma.js";

await prisma.actionLog.deleteMany();
await prisma.ticket.deleteMany();
await prisma.day.deleteMany();
await prisma.event.deleteMany();
await prisma.event.create({ data: { name: "e2e event" } });
await prisma.$disconnect();
