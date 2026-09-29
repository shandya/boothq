# CLAUDE.md — BoothQ

Guidance for Claude Code working in this repository. Read this file first, then the docs it points to.

## What we're building

A mobile-first queue system for a **live illustration booth**. Staff create a ticket for each walk-up customer (name + phone), show a QR code on their phone, and the customer scans it to open a private page showing their number, the number currently being served, how many people are ahead, and an estimated wait. The illustrator runs the queue from their own phone.

Three audiences:

- **Customer**: no login. Private link `/t/[token]`.
- **Admin**: opens/closes the booth, creates/edits/removes tickets, re-shows or regenerates QR links, reorders the queue.
- **Illustrator**: calls the next customer, starts/finishes drawing sessions, handles no-shows, takes breaks.

The ADMIN role can do everything the ILLUSTRATOR role can do.

## Naming

**BoothQ** is this app's own name (shown to staff on the login screen, in the PWA/browser tab title, and in the manifest). It is separate from **the booth's own name**, which each installation sets via `NEXT_PUBLIC_BOOTH_NAME` and which is the only name customers ever see — customer-facing screens (the ticket page, WhatsApp messages) never mention BoothQ.

## Docs (source of truth)

| File | Contents |
|---|---|
| `docs/PRD.md` | Features per role, MVP vs later, non-functional requirements |
| `docs/ARCHITECTURE.md` | Repo layout, hosting, auth, polling, env vars, deployment |
| `docs/DATA_MODEL.md` | Prisma schema, ticket state machine, invariants |
| `docs/BUSINESS_LOGIC.md` | Numbering, ordering, locking, ETA algorithm + test cases |
| `docs/API.md` | Every endpoint with request/response shapes and error codes |
| `docs/UI.md` | Every screen, per role |
| `docs/PHOTO_TICKETS.md` | Draw-from-photo feature (after MVP): data, storage, API, UI |
| `docs/EVENTS.md` | Events feature (after MVP): grouping Days per venue, scoped wait-time history |
| `docs/IMPLEMENTATION_PLAN.md` | Ordered build phases with checkboxes and acceptance criteria |

If two docs conflict, stop and ask. If the code must diverge from a doc, update the doc in the same change.

## Stack

- **Monorepo** with pnpm workspaces
- `apps/web`: Next.js (App Router, TypeScript), Tailwind CSS, TanStack Query, `qrcode.react`. Deployed on Vercel.
- `apps/api`: Node + Express 5 (TypeScript), Prisma, PostgreSQL. Deployed as a second Vercel project (serverless) or on Railway/Render.
- `packages/shared`: zod schemas, enums, DTO types, WhatsApp message templates, and the pure ETA function. Used by both apps.

Use the latest stable versions of each dependency at scaffold time.

## Commands

```bash
pnpm install
docker compose up -d                 # local Postgres
pnpm dev                             # web on :3000, api on :4000
pnpm --filter api db:migrate         # prisma migrate dev
pnpm --filter api db:seed            # sample day + tickets
pnpm --filter api hash-pin 123456    # prints a bcrypt hash for .env
pnpm test                            # all workspaces
pnpm lint && pnpm typecheck
```

## Rules

1. TypeScript `strict` everywhere. No `any`, no `@ts-ignore` without a comment explaining why.
2. Validate every request body and query with zod schemas from `packages/shared`. The web app uses the same schemas for its forms.
3. The API is **stateless**. It may run as serverless functions, so no in-memory state (no in-memory queues, no timers, no websockets). All state lives in Postgres.
4. Every ticket or day state change goes through the service layer (`apps/api/src/services/queue.service.ts`) inside a transaction that locks the open Day row (see `docs/BUSINESS_LOGIC.md`). Route handlers never update `ticket.status` directly.
5. Use server time. The API returns `serverTime` in snapshots; the web app corrects timers for clock skew. Never trust timestamps sent by clients.
6. Customer-facing responses never include phone numbers, other customers' names, internal IDs, or staff notes.
7. Mobile first: design at 375px width, tap targets at least 44px, primary actions in the bottom half of the screen for thumb reach.
8. Visual style is iOS 27 and the color scheme follows the device (light/dark) with no in-app toggle. Use only the color tokens in `docs/UI.md` → Visual style; never hard-code colors in components.
9. Tests are required for the ETA function, every state transition, ticket numbering, and reordering. Run lint, typecheck and tests before calling a task done.
10. Work through `docs/IMPLEMENTATION_PLAN.md` phase by phase. Tick checkboxes as tasks complete. Don't start a phase until the previous phase's acceptance criteria pass.
11. Small, focused commits, one task each, with conventional commit messages (`feat(api): ...`, `fix(web): ...`).
12. Don't add dependencies beyond those listed in `docs/ARCHITECTURE.md` without saying why.

## Glossary

- **Day**: one opening of the booth, from Open to Close. Ticket numbers restart at 1 each Day. A Day is not tied to a calendar date (an event can run past midnight).
- **Ticket**: one customer in the queue.
- **Event** (after MVP, `docs/EVENTS.md`): one run of the booth at a venue, e.g. a convention. Contains one or more Days and scopes the measured wait-time history. Ticket numbers still restart per Day.
- **Session**: the drawing time for one ticket, from Start to Finish. The last 10 session durations (and the gaps between them) drive the ETA.
- **Current ticket**: the single ticket that is `CALLED` or `SERVING`. At most one exists at a time.
- **Break**: a pause of the whole queue (illustrator resting). Customers see a banner and ETAs include the break.
