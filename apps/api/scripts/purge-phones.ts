import { prisma } from "../src/lib/prisma.js";
import { purgeExpiredPhones } from "../src/services/retention.service.js";

const count = await purgeExpiredPhones();
console.log(`Erased ${count} phone number${count === 1 ? "" : "s"}.`);
await prisma.$disconnect();
