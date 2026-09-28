# Implementation Plan

Work top to bottom. Tick each box when done. Each phase ends with acceptance criteria that must pass before moving on. At the end of each phase, report: what was built, how to verify it by hand, doc changes, and open questions.

---

## Phase 0 — Scaffold

Docs: `ARCHITECTURE.md`

- [x] Root: `pnpm-workspace.yaml`, `package.json` with `dev`, `build`, `test`, `lint`, `typecheck` scripts, `tsconfig.base.json` (strict), ESLint + Prettier, `.gitignore`, `.nvmrc` (current Node LTS)
- [x] `docker-compose.yml` with Postgres 16 (port 5432, volume) and a second database for tests
- [x] `packages/shared`: TypeScript package, builds or is consumed as source by both apps, exports an `index.ts`
- [x] `apps/api`: Express 5 + TypeScript, `src/app.ts` (exports app) and `src/server.ts` (listens on `PORT`), `GET /api/health`, helmet, cookie-parser, JSON body limit 10kb, central error handler producing the error format in `API.md`
- [x] `apps/web`: Next.js App Router + Tailwind, TanStack Query provider, `/api` rewrite in `next.config.ts`
- [x] `pnpm dev` runs both with `concurrently`
- [x] `.env.example` for both apps
- [x] Vitest configured in `shared` and `api`

**Acceptance**
- `pnpm install && docker compose up -d && pnpm dev` works from a clean clone.
- Visiting `http://localhost:3000/api/health` returns `{ "ok": true }` through the rewrite.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass.

---

## Phase 1 — Data model and shared logic

Docs: `DATA_MODEL.md`, `BUSINESS_LOGIC.md` §5

- [x] Prisma schema exactly as in `DATA_MODEL.md`, first migration including the `one_open_day` partial unique index
- [x] Prisma client singleton (`src/lib/prisma.ts`) safe for serverless hot reloads
- [x] `seed.ts`: an open Day with 3 DONE tickets (varied durations), 1 SERVING, 4 WAITING
- [x] `shared/enums.ts`, `shared/schemas.ts` (all request bodies in `API.md`), `shared/dto.ts`
- [x] `shared/eta.ts` + all 10 test cases from `BUSINESS_LOGIC.md`
- [x] `shared/format.ts` (duration and ETA display rules) + tests
- [x] `shared/messages.ts` (WhatsApp templates) + `buildWhatsAppUrl(phoneE164, text)` + tests
- [x] `api/src/lib/phone.ts`: normalize with libphonenumber-js and `DEFAULT_COUNTRY`, return E.164 + national display + tests (local format, with country code, with spaces/dashes, invalid)
- [x] `api/scripts/hash-pin.ts`

**Acceptance**
- `pnpm --filter api db:migrate && pnpm --filter api db:seed` succeeds.
- All shared tests pass.

---

## Phase 2 — API

Docs: `API.md`, `BUSINESS_LOGIC.md`, `ARCHITECTURE.md` (auth, rate limiting)

- [x] Auth: login/logout/me, JWT cookie, `requireRole`, Origin + JSON content-type check on mutations, login rate limit
- [x] `withOpenDayLock`, `renumberWaiting`, `AppError`
- [x] `queue.service.ts`: every operation in `BUSINESS_LOGIC.md` §4, each writing an `ActionLog`
- [x] `snapshot.service.ts`: builds `QueueSnapshot` (including per-ticket ETA and stats with projected finish) and `PublicTicketView`
- [x] Routes: auth, public, queue, tickets, day
- [x] Public token rate limit (per token), `Cache-Control: no-store` on public and queue responses
- [x] Integration tests (supertest against the test DB, reset between tests) covering:
  - [x] login success / wrong PIN / illustrator blocked from admin routes
  - [x] open day twice → `DAY_ALREADY_OPEN`
  - [x] ticket numbers 1, 2, 3; numbers not reused after cancel; restart at 1 on a new day
  - [x] duplicate phone → 409 with existing ticket; `force` bypasses
  - [x] `NOT_ACCEPTING` and `force`
  - [x] full happy path: create → call-next → start → finish → DONE with `durationSec`
  - [x] finish with `callNext` calls the next ticket in the same request
  - [x] call-next while someone is current → `CURRENT_ACTIVE`; empty queue → `QUEUE_EMPTY`; wrong `expectedNextId` → `STALE_STATE`
  - [x] 10 concurrent call-next requests → exactly one succeeds
  - [x] requeue puts the ticket after N people; positions stay 1..n
  - [x] reorder writes positions 1..n in the given order; rejects a list that adds, drops, or duplicates a ticket; rejects a list taken before a concurrent change (e.g. a cancel) invalidated it
  - [x] no-show then requeue
  - [x] customer cancel from WAITING and CALLED; cancel from SERVING → 409; cancel twice → 200
  - [x] rotate-token → old token 404, new token works
  - [x] public view never contains `phone`, `notes`, `id`, or other customers' names (assert on the JSON keys)
  - [x] `almostUp` flips at the threshold (see heads-up tests in `BUSINESS_LOGIC.md`); `headsUpAhead` settable on open/PATCH
  - [x] pause blocked while SERVING; call-next blocked while paused; ETA includes timed break
  - [x] close day cancels WAITING/CALLED with `DAY_CLOSED`; blocked while SERVING

**Acceptance**
- All tests pass. Invariants in `DATA_MODEL.md` hold after every test (add an `assertInvariants(dayId)` helper and call it in `afterEach`).

---

## Phase 3 — Web foundation, login, admin

Docs: `UI.md` (shared, login, admin)

- [x] Theme foundation (PRD L1, L2): color tokens from `UI.md` as CSS variables with a `prefers-color-scheme: dark` override, `color-scheme: light dark`, per-scheme `theme-color` meta tags, Tailwind wired to the variables (`darkMode: 'media'`), font stack with Inter via `next/font/google`, glass utility class with solid fallbacks
- [x] Base components in the iOS style: `LargeTitle`, `GroupedList` + `GroupedRow`, `CapsuleButton` (primary / secondary / destructive), `GlassIconButton`, `GlassBar`, `SegmentedControl`, `Switch`, `SearchField`, `Sheet` (inset, 38px radius), `StatusChip`
- [x] API client (`lib/api.ts`) with typed functions, error parsing, and 409-snapshot handling
- [x] Query hooks: `useQueue()` (5 s), `usePublicTicket(token)` (10 s), mutations that write the returned snapshot into the cache
- [x] Server-time offset store + `ElapsedTimer`
- [x] Shared components from `UI.md`
- [x] `/login`
- [x] Route guard for `/admin` and `/illustrator` via `/api/auth/me`
- [x] `/admin`: closed state + Open booth, header, search, sections, rows
- [x] New ticket sheet with shared zod validation, duplicate flow, `QrFullscreen`
- [x] Ticket sheet with all actions, confirm sheets
- [x] Settings sheet, Close booth flow + summary

**Acceptance**
- Toggling the OS appearance (or DevTools "prefers-color-scheme") switches every screen between light and dark instantly, without reload, and all text passes AA in both.
- On a 375px viewport: open booth, create 5 tickets, show a QR, scan it with a real phone, edit one, move one, remove one, regenerate one link and confirm the old link shows "Ticket not found".

---

## Phase 4 — Illustrator console

Docs: `UI.md` (illustrator), `PRD.md` I1–I13

- [ ] Header stats strip including projected finish time
- [ ] Now card with every state from the table in `UI.md`
- [ ] Session timer with pace colors
- [ ] Up next list (number, name, notes, waited time; no message buttons)
- [ ] Not-here sheet (requeue / no-show), Recall with WhatsApp
- [ ] Break sheet + Resume; accepting toggle
- [ ] Wake Lock hook with fallback indicator
- [ ] Pending/disabled buttons, haptics, 409 toast + resync

**Acceptance**
- With two browsers (admin + illustrator): run 5 customers through call → start → finish, including one no-show and one requeue. Both screens agree within 5 s. Double-tapping any button never causes a wrong state.

---

## Phase 5 — Customer page

Docs: `UI.md` (customer), `PRD.md` C1–C8

- [ ] `/t/[token]` with every state and banner from `UI.md`
- [ ] ETA display rules, "based on average" note, confidence note
- [ ] Heads-up banner + "Almost up" chip driven by `almostUp`
- [ ] CALLED takeover that re-appears when `calledAt` changes
- [ ] Cancel flow
- [ ] Dynamic tab title, Copy link, Updated-X-ago, offline banner
- [ ] `robots: noindex` on customer pages; no analytics
- [ ] Not-found state

**Acceptance**
- With the illustrator console on one phone and a customer page on another: the customer page updates within 10 s of every illustrator action, the heads-up banner appears once 3 or fewer people are ahead, ETA shrinks as sessions finish, break banner appears and disappears, cancel works and the ticket disappears from the illustrator's up-next list.

---

## Phase 6 — Polish and deploy

- [ ] Empty, loading, error states on every screen
- [ ] Contrast check in both schemes, font scaling check, Reduce Transparency / Increase Contrast check
- [ ] Favicon and `manifest.json` (`name`/`short_name`: "BoothQ", the app's own name) so staff can "Add to Home Screen"; browser tab `<title>` combines both, e.g. "BoothQ · {NEXT_PUBLIC_BOOTH_NAME}"
- [ ] Deploy per `ARCHITECTURE.md` → Deployment checklist
- [ ] README: local setup, env vars, deploy steps, how to change PINs

**Acceptance: real-phone rehearsal**
1. Staff phone A logs in as Admin, phone B as Illustrator, on mobile data (not Wi-Fi).
2. Create 4 tickets; scan 2 of them with a third phone.
3. Run a full cycle including break, recall, no-show, requeue, customer cancel, regenerate link, WhatsApp link sending.
4. Leave the illustrator console open 10 minutes: the screen stays on.
5. Close the booth; summary numbers are correct.

---

## Phase 7 — P1 features

- [ ] Undo (`POST /api/queue/undo` from ActionLog + toast)
- [ ] `/display` screen
- [ ] Customer alerts (sound/vibration opt-in)
- [ ] Bilingual customer page (simple dictionary, language toggle, remembers choice in localStorage)
- [ ] Day history + CSV export
- [ ] Phone retention clean-up (script + scheduled job, e.g. Vercel Cron, nulls `phone` 30 days after `closedAt`)
- [ ] Playwright e2e happy path on a mobile viewport

---

## Phase 8 — Draw from photo (after MVP)

Docs: `PHOTO_TICKETS.md`

- [ ] Migration: `TicketMode`, `READY` status, photo and pickup fields; update invariants helper
- [ ] `PhotoStorage` interface + Vercel Blob implementation + in-memory fake for tests
- [ ] Endpoints: upload-token, confirm (sets mode), view, delete (resets mode), picked-up
- [ ] Service rules: call-next skips CALLED for photo tickets, out-of-order start, finish → READY + delete photo, close day keeps READY + deletePrefix
- [ ] Snapshot/public view: `readyForPickup`, `readyEta`, `almostUp` false for photo tickets
- [ ] Web: client-side resize + EXIF strip, upload with progress/retry, photo row in New ticket sheet and Ticket sheet
- [ ] Illustrator: photo Now card with full-screen zoom, camera icons in Up next, "Start" instead of "Call" for virtual tickets
- [ ] Admin: Ready for pickup section with WhatsApp + Picked Up
- [ ] Customer: photo waiting state and Ready screen
- [ ] All tests listed in `PHOTO_TICKETS.md`

**Acceptance**
- On real phones: create a photo ticket with the camera and one from the library; draw one in line and convert one in-person ticket to virtual by adding a photo from the ticket sheet; the customer page moves to Ready; mark picked up. Confirm in the Blob dashboard that no photos remain after finishing and after closing the day.
