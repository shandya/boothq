# Architecture

## Repository: one monorepo

Frontend and backend live in one repository using pnpm workspaces. Reasons:

- One developer, one release rhythm; a feature usually touches both sides and should land in one commit.
- `packages/shared` holds zod schemas, DTO types and the ETA function, so the API and UI can't drift apart.
- Claude Code sees both sides in one session, so it can change an endpoint and its caller together.
- Vercel deploys several projects from one repo by setting each project's Root Directory.

### `packages/shared` builds to `dist/`, not consumed as raw source

`packages/shared/package.json`'s `main`/`types`/`exports` point at `./dist/*`
(compiled JS + `.d.ts`), not `./src/*.ts`. A plain `import ... from "@boothq/shared"`
resolved by bare Node (no TypeScript loader) — exactly what a Vercel serverless
function runs — cannot load a `.ts` file directly, so pointing the package at
raw source works for local dev (`tsx`, Next's bundler) but breaks in production
with `ERR_MODULE_NOT_FOUND`. Consequences:

- `pnpm install` runs a root `postinstall` hook (`pnpm --filter @boothq/shared build`)
  so `dist/` always exists right after install, before `pnpm dev` ever runs.
- `pnpm dev` also runs `packages/shared`'s own `tsc --watch`, so editing shared
  source recompiles `dist/` live for both dev servers to pick up.
- `apps/api` and `apps/web`'s own `build` scripts each rebuild `@boothq/shared`
  first (`pnpm --filter @boothq/shared build && ...`) — Vercel invokes each
  project's build script directly, scoped to that project's Root Directory, so
  the root's own orchestrated `build` script (and its `postinstall`) can't be
  relied on alone.

```
booth-queue/
├─ CLAUDE.md
├─ docs/
├─ .claude/commands/          # custom Claude Code slash commands
├─ docker-compose.yml         # local Postgres 16
├─ package.json               # root scripts: dev, test, lint, typecheck
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ apps/
│  ├─ web/                    # Next.js
│  │  ├─ app/
│  │  │  ├─ page.tsx          # landing: booth name + staff login link
│  │  │  ├─ t/[token]/page.tsx
│  │  │  ├─ login/page.tsx
│  │  │  ├─ admin/page.tsx
│  │  │  ├─ illustrator/page.tsx
│  │  │  └─ display/page.tsx  # P1
│  │  ├─ components/
│  │  ├─ lib/                 # api client, query hooks, wake lock, whatsapp link builder
│  │  └─ next.config.ts       # /api rewrite to the API
│  └─ api/
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  ├─ migrations/
│     │  └─ seed.ts
│     ├─ scripts/hash-pin.ts
│     └─ src/
│        ├─ app.ts            # builds and exports the Express app (no listen)
│        ├─ server.ts         # app.listen for local dev / Railway / Render
│        ├─ routes/           # auth, public, queue, tickets, day, stats
│        ├─ services/
│        │  ├─ queue.service.ts   # ALL state transitions live here
│        │  ├─ day-lock.ts        # withOpenDayLock(tx => ...)
│        │  └─ snapshot.service.ts
│        ├─ middleware/       # auth, error handler, rate limit, origin check
│        └─ lib/              # prisma client, jwt, phone, token
└─ packages/
   └─ shared/
      └─ src/
         ├─ enums.ts
         ├─ schemas.ts        # zod request schemas
         ├─ dto.ts            # response types
         ├─ eta.ts            # pure ETA function
         ├─ messages.ts       # WhatsApp message templates
         └─ format.ts         # duration and ETA display helpers
```

## Runtime topology

```
Customer / staff phone
        │ HTTPS
        ▼
apps/web  (Next.js on Vercel)
        │  rewrite: /api/*  →  ${API_URL}/api/*
        ▼
apps/api  (Express: 2nd Vercel project, or Railway / Render)
        │  Prisma
        ▼
PostgreSQL  (Neon, Supabase, or Railway)
```

### Why the `/api` rewrite

The browser only ever talks to the web domain. `next.config.ts` proxies `/api/*` to the Express app:

```ts
async rewrites() {
  return [{ source: '/api/:path*', destination: `${process.env.API_URL}/api/:path*` }];
}
```

Everything is same-origin, so the staff session cookie is a normal first-party cookie (no cross-site cookie problems on iOS Safari) and CORS isn't needed. In dev, `API_URL=http://localhost:4000`.

### Hosting the API

The design deliberately avoids long-lived connections (polling instead of websockets), so the API can run either way:

- **Vercel (second project, root `apps/api`)**: runs Express as serverless functions. Follow Vercel's current Express guidance at deploy time (typically: default-export the app from the entry file). Use a pooled Postgres connection string.
- **Railway or Render**: a normal long-running Node process via `src/server.ts`. Pick this if websockets/SSE are wanted later.

`src/app.ts` must work in both: it exports the app and never calls `listen`.

## Live updates: polling

- TanStack Query with `refetchInterval`: **10 s** on the customer page, **5 s** on staff pages.
- `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`.
- Every staff mutation returns a fresh `QueueSnapshot`, which the client writes straight into the query cache, so the acting phone updates instantly.
- Responses include `serverTime`. The client stores `offset = serverTime - Date.now()` and uses it for timers ("drawing for 6:12", "called 2 min ago").

Upgrade path (not v1): replace staff polling with SSE on a long-running host.

## Auth

- Two roles: `ADMIN`, `ILLUSTRATOR`. Each has a PIN (6+ digits). Only bcrypt hashes are stored, in env vars `ADMIN_PIN_HASH` and `ILLUSTRATOR_PIN_HASH`. `pnpm --filter api hash-pin <pin>` prints a hash. Use `bcryptjs` (pure JS, serverless-friendly).
- `POST /api/auth/login { role, pin }` sets cookie `bq_session`: a JWT (HS256, `jose`) with `{ role }`, 12 h expiry. Cookie flags: `httpOnly`, `secure` in production, `sameSite=lax`, `path=/`.
- `requireRole('ILLUSTRATOR')` accepts ILLUSTRATOR or ADMIN. `requireRole('ADMIN')` accepts ADMIN only.
- Web pages call `GET /api/auth/me` on load and redirect to `/login?next=...` on 401.
- CSRF: mutations require `Content-Type: application/json` and an `Origin` header matching `PUBLIC_WEB_URL` (or absent for same-origin server calls). Combined with `sameSite=lax`, this is sufficient here.
- Customers never log in. Their token (nanoid, 16 chars, URL-safe) is the credential.

## Rate limiting

`express-rate-limit`:

- Login: 5 requests / minute / IP.
- Public ticket endpoints: 30 requests / minute **per token** (not per IP: many customers share an IP on mobile carrier NAT or venue Wi-Fi).

On serverless the default memory store is per instance, so limits are best-effort. That's acceptable for v1; note it in code.

## Dependencies

**web**: next, react, react-dom, tailwindcss, @tanstack/react-query, qrcode.react, libphonenumber-js, zod, clsx, lucide-react. Font: Inter via `next/font/google` (self-hosted at build time, no runtime request to Google).
**api**: express, prisma, @prisma/client, zod, jose, bcryptjs, nanoid, libphonenumber-js, helmet, cookie-parser, express-rate-limit.
**dev**: typescript, tsx, vitest, supertest, eslint, prettier, concurrently.

Version pins that diverge from "latest" on purpose: `typescript` is pinned to the 5.x line (`typescript-eslint` doesn't yet support TypeScript 7's new CLI). `prisma`/`@prisma/client` are pinned to the 6.x line — Prisma 7+ removed `datasource.url`/`directUrl` from `schema.prisma` in favor of a `prisma.config.ts`, which would break the schema and `prisma migrate dev` workflow documented in `DATA_MODEL.md`. Revisit both pins periodically.
**e2e (P1)**: @playwright/test.

## Environment variables

`apps/api/.env`

```
DATABASE_URL=postgresql://...          # pooled URL in production
DIRECT_URL=postgresql://...            # direct URL for migrations
JWT_SECRET=<32+ random bytes>
ADMIN_PIN_HASH=<bcrypt hash>
ILLUSTRATOR_PIN_HASH=<bcrypt hash>
PUBLIC_WEB_URL=https://your-booth.vercel.app   # used to build customer links and check Origin
DEFAULT_COUNTRY=ID                     # ISO country for parsing local phone numbers; change as needed
PORT=4000
```

`apps/web/.env`

```
API_URL=http://localhost:4000          # server-side only, used by the rewrite
NEXT_PUBLIC_BOOTH_NAME=My Illustration Booth   # shown to customers; this installation's own branding
NEXT_PUBLIC_SOCIAL_HANDLE=@yourhandle  # shown on the Done screen, optional
NEXT_PUBLIC_DEFAULT_COUNTRY=ID
```

`NEXT_PUBLIC_BOOTH_NAME` is what customers see everywhere (ticket page, WhatsApp messages). The app itself is called **BoothQ**; that name appears only on staff-facing screens (login, PWA manifest, browser tab title) — see `CLAUDE.md` → Naming.

Commit `.env.example` files for both. Never commit real `.env` files.

## File storage (after MVP)

The draw-from-photo feature stores small JPEGs in a private Vercel Blob store, uploaded straight from the browser (never through Express, because Vercel Functions reject bodies over 4.5 MB). Details in `PHOTO_TICKETS.md`. Adds `@vercel/blob` and the `BLOB_READ_WRITE_TOKEN` env var.

## Hosting plan note

Vercel's free Hobby plan is for personal, non-commercial use. Use it to build and test; before taking paying customers, move to Vercel Pro or another host whose free tier allows commercial use. Nothing in the code depends on the plan.

## Deployment checklist

1. Create a Postgres database (Neon via the Vercel Marketplace is simplest). Copy the pooled and direct URLs.
2. Vercel project **booth-queue-api**: root `apps/api`, set api env vars, build runs `prisma generate` and `prisma migrate deploy`.
3. Vercel project **booth-queue-web**: root `apps/web`, set `API_URL` to the API project's production URL plus the `NEXT_PUBLIC_*` vars.
4. Set `PUBLIC_WEB_URL` on the API to the web project's production URL.
5. Smoke test on two real phones (see Phase 6 in `IMPLEMENTATION_PLAN.md`).
