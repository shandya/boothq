# BoothQ

A mobile-first queue system for a live illustration booth. Staff create a
ticket for each walk-up customer, show them a QR code, and the customer
scans it to open a private page showing their number, who's being served,
how many people are ahead, and an estimated wait. The illustrator runs the
queue from their own phone.

Full feature and design docs live in [`docs/`](docs/) — see
[`docs/PRD.md`](docs/PRD.md) for what it does and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it's built.

## Local setup

Prerequisites: Node 22+ (see `.nvmrc`), [pnpm](https://pnpm.io), and Docker
(for local Postgres).

```bash
pnpm install
docker compose up -d                 # starts Postgres 16 on :5432
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and set `ADMIN_PIN_HASH` / `ILLUSTRATOR_PIN_HASH` — see
[Changing PINs](#changing-pins) below. Then:

```bash
pnpm --filter api db:migrate         # create tables
pnpm --filter api db:seed            # optional: a sample day + tickets
pnpm dev                             # web on :3000, api on :4000
```

Visit `http://localhost:3000/login`, sign in as Admin, tap **Start Event**
(name the venue, e.g. "Comic Con 2026"), then **Open Booth**. A Day always
belongs to an Event; wait-time estimates are learned per Event. The seed
script creates a "Sample event" for you.

### Other commands

```bash
pnpm test                            # all workspaces
pnpm lint
pnpm typecheck
pnpm build
```

## Environment variables

Full reference: [`docs/ARCHITECTURE.md` → Environment variables](docs/ARCHITECTURE.md#environment-variables).

**`apps/api/.env`**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled, in production) |
| `DIRECT_URL` | Direct Postgres connection, used for migrations |
| `JWT_SECRET` | 32+ random bytes signing the staff session cookie |
| `ADMIN_PIN_HASH` / `ILLUSTRATOR_PIN_HASH` | bcrypt hashes of each role's PIN |
| `PUBLIC_WEB_URL` | The web app's URL; builds customer links and checks the `Origin` header |
| `DEFAULT_COUNTRY` | ISO country for parsing local phone numbers (e.g. `ID`) |
| `PORT` | API port for local dev / a long-running host |

**`apps/web/.env`**

| Variable | Purpose |
|---|---|
| `API_URL` | Server-side only; where `next.config.ts`'s `/api` rewrite points |
| `NEXT_PUBLIC_BOOTH_NAME` | The booth's own name — the only name customers ever see |
| `NEXT_PUBLIC_SOCIAL_HANDLE` | Optional, shown on the customer's "Done" screen |
| `NEXT_PUBLIC_DEFAULT_COUNTRY` | ISO country for the phone input's placeholder/formatting |

`NEXT_PUBLIC_BOOTH_NAME` is this installation's own branding. **BoothQ** is
this app's own name, shown only on staff-facing screens (login, browser tab,
PWA manifest) — see `CLAUDE.md` → Naming.

## Changing PINs

```bash
pnpm --filter api hash-pin 123456    # prints a bcrypt hash
```

Put the printed hash in `ADMIN_PIN_HASH` or `ILLUSTRATOR_PIN_HASH` (in
`apps/api/.env` locally, or the hosting provider's env var settings in
production) and restart/redeploy the API. PINs are never stored in plain
text, only their bcrypt hash.

## Deploying

Full checklist: [`docs/ARCHITECTURE.md` → Deployment checklist](docs/ARCHITECTURE.md#deployment-checklist).
Short version, deploying to Vercel with a Neon Postgres database:

1. Create a Postgres database (Neon via the Vercel Marketplace is simplest);
   copy the pooled and direct connection strings.
2. Create a Vercel project **booth-queue-api** with root directory
   `apps/api`; set its env vars from the table above. Its build runs
   `prisma generate` and `prisma migrate deploy`.
3. Create a Vercel project **booth-queue-web** with root directory
   `apps/web`; set `API_URL` to the API project's production URL, plus the
   `NEXT_PUBLIC_*` vars.
4. Set `PUBLIC_WEB_URL` on the API project to the web project's production
   URL, and redeploy the API.
5. Smoke test on two real phones — see the real-phone rehearsal in
   [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) → Phase 6.

Vercel's free Hobby plan is for personal, non-commercial use — move to
Vercel Pro (or another host) before taking paying customers.
