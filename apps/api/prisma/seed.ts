import { nanoid } from "nanoid";
import { prisma } from "../src/lib/prisma.js";

const MIN = 60_000;

async function main() {
  const now = Date.now();

  const day = await prisma.day.create({
    data: {
      status: "OPEN",
      openedAt: new Date(now - 90 * MIN),
      nextNumber: 9,
      acceptingTickets: true,
      headsUpAhead: 3,
    },
  });

  const doneTickets = [
    { name: "Amara Putri", phone: "+6281234567801", offsetMin: 85, durationSec: 420 },
    { name: "Budi Santoso", phone: "+6281234567802", offsetMin: 75, durationSec: 540 },
    { name: "Citra Dewi", phone: "+6281234567803", offsetMin: 62, durationSec: 900 },
  ];

  for (const [i, t] of doneTickets.entries()) {
    const startedAt = new Date(now - t.offsetMin * MIN);
    const endedAt = new Date(startedAt.getTime() + t.durationSec * 1000);
    await prisma.ticket.create({
      data: {
        dayId: day.id,
        number: i + 1,
        name: t.name,
        phone: t.phone,
        token: nanoid(16),
        status: "DONE",
        position: null,
        calledAt: new Date(startedAt.getTime() - 2 * MIN),
        callCount: 1,
        startedAt,
        endedAt,
        durationSec: t.durationSec,
      },
    });
  }

  await prisma.ticket.create({
    data: {
      dayId: day.id,
      number: 4,
      name: "Dian Kusuma",
      phone: "+6281234567804",
      notes: "Wants a superhero pose",
      token: nanoid(16),
      status: "SERVING",
      position: null,
      calledAt: new Date(now - 5 * MIN),
      callCount: 1,
      startedAt: new Date(now - 3 * MIN),
    },
  });

  const waitingTickets = [
    { name: "Eka Wijaya", phone: "+6281234567805" },
    { name: "Fajar Nugroho", phone: "+6281234567806" },
    { name: "Gita Permata", phone: "+6281234567807" },
    { name: "Hendra Saputra", phone: null },
  ];

  for (const [i, t] of waitingTickets.entries()) {
    await prisma.ticket.create({
      data: {
        dayId: day.id,
        number: i + 5,
        name: t.name,
        phone: t.phone,
        token: nanoid(16),
        status: "WAITING",
        position: i + 1,
      },
    });
  }

  console.log(`Seeded Day ${day.id} with 3 DONE, 1 SERVING, 4 WAITING tickets.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
