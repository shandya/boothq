# Product Requirements — BoothQ

## Problem

At a live illustration booth each portrait takes several minutes, so a line forms fast and people leave rather than stand in it. Customers should be able to take a ticket, walk around the event, and come back when their turn is near.

## Goals

- Creating a ticket takes staff under 30 seconds.
- Customers see their place and a realistic wait estimate on their own phone, with no app install and no login.
- The illustrator can run the queue one-handed on a phone between drawings.
- Works on weak event Wi-Fi or mobile data (small payloads, graceful offline state).

## Non-goals for v1

- Customers creating their own tickets (staff always create them).
- Customers uploading their own photo from the ticket page (possible later extension of `PHOTO_TICKETS.md`).
- Payments.
- Several illustrators drawing in parallel (don't block it in the data model, but don't build it).
- Automatic SMS/WhatsApp sending, or any WhatsApp integration at all. v1 has no messaging feature; the customer link works entirely through the QR code and its URL.
- Native apps or web push notifications.

## Roles

| Role | Access | Login |
|---|---|---|
| Customer | Own ticket page only | None, unguessable link |
| Illustrator | Illustrator console; can register walk-up tickets (same New Ticket flow as Admin) but can't open/close the booth, edit/remove tickets, reorder the queue, or change settings | PIN |
| Admin | Everything, including illustrator console | PIN |

## Core flow

1. Admin taps **Open booth**, which starts a Day.
2. A customer walks up. Admin or Illustrator taps **New ticket**, enters name and phone, taps Create. A full-screen QR appears.
3. Customer scans the QR with their camera and lands on `/t/{token}`: their number, now serving, people ahead, estimated wait.
4. Illustrator taps **Call next**. The customer's page switches to "It's your turn".
5. Customer sits down. Illustrator taps **Start drawing**, which starts the session timer.
6. Illustrator taps **Finish** (or **Finish & call next**). The session duration and the gap before the next Start feed the measured drawing time and time between customers (last 10 customers), which update everyone's ETA.
7. At the end, admin taps **Close booth** and sees a day summary.

## Features

Priority: **MVP** = build first. **P1** = right after MVP. **P2** = later.

### Customer page

| ID | Feature | Priority |
|---|---|---|
| C1 | Shows their number and first name, the number now being served, people ahead, and ETA as a range plus clock time ("~20–25 min, around 14:35"). Small note: "Based on the recent average drawing time of 8 min." | MVP |
| C2 | Clear state for each status: waiting, your turn, being drawn, done, missed (no-show), cancelled, plus booth-on-break and booth-closed banners | MVP |
| C3 | Auto-refresh every 10 s, "Updated 4 s ago" label, offline indicator, pauses polling when the tab is hidden, refreshes on focus | MVP |
| C4 | Cancel my place, with a confirmation sheet | MVP |
| C5 | "It's your turn" full-screen takeover when status becomes CALLED | MVP |
| C5a | **Heads-up banner** when 3 or fewer people are ahead: "Start heading back to the booth. Only 3 people ahead of you. Your turn is in about 20 minutes." Gives customers who wandered across the venue time to walk back. The threshold is a per-day setting (default 3) | MVP |
| C6 | Browser tab title shows live position, e.g. `#12 · 3 ahead`, so it's readable from the tab switcher | MVP |
| C7 | Copy-link button and a hint to bookmark the page | MVP |
| C8 | Done screen: thank you + booth social handle | MVP |
| C9 | Opt-in sound and vibration alert when the heads-up banner first appears and when called (needs one tap to unlock audio; vibration doesn't work on iOS) | P1 |
| C10 | Bilingual page (e.g. English + Bahasa Indonesia) with a toggle | P1 |

### Admin

| ID | Feature | Priority |
|---|---|---|
| A1 | Open booth (set the heads-up threshold) and Close booth (remaining waiting tickets are cancelled, with confirmation). Drawing time and time between customers are never typed in: they're measured automatically from the last 10 customers and shown read-only in Settings | MVP |
| A2 | New ticket form: name, phone, optional notes (e.g. "couple portrait", "cat ears"). Phone validated and normalized to E.164 | MVP |
| A3 | Duplicate check: if that phone already has an active ticket today, offer "Show their existing QR" or "Create anyway" | MVP |
| A4 | Full-screen QR after creating, with number and name, plus **Copy link** | MVP |
| A5 | Queue list grouped by Now / Waiting / Finished / Cancelled, with search by name, phone or number | MVP |
| A6 | Edit name, phone, notes | MVP |
| A7 | Remove ticket (soft delete, kept for stats) | MVP |
| A8 | **Drag to reorder** the waiting list (Waiting section → Reorder), with a confirmation prompt before the new order is applied, since it changes people's wait times | MVP |
| A9 | **Show QR again** (same link) for customers who lost the page | MVP |
| A10 | **Regenerate link**: new token, old link stops working. For a link sent to the wrong number or shared around | MVP |
| A11 | Accepting-tickets toggle. When off, creating a ticket needs an explicit override | MVP |
| A12 | Day summary on close: served, no-shows, cancelled, average session, longest wait | MVP |
| A13 | History of previous days + CSV export (grouped by Event once A15 ships) | P1 |
| A14 | Privacy clean-up: phone numbers erased automatically 30 days after the Day closes | P1 |
| A15 | **Events**: start, rename and end an Event (e.g. one convention). An Event contains one or more Days. Starting a new Event means wait-time estimates are re-learned from scratch; ticket numbers still restart per Day. Spec: `EVENTS.md` | P2 |
| A16 | Events list: name, dates, number of Days, served count | P2 |

### Illustrator console

The illustrator uses this between drawings, often with one hand and paint on the other, so everything is big and forgiving.

| ID | Feature | Priority |
|---|---|---|
| I1 | **Now card**: number, name, notes, status (called X min ago / drawing) | MVP |
| I2 | **Call next** button showing who's next ("Call #10 Budi"). Disabled while someone is current | MVP |
| I3 | **Start drawing / Finish** with a large plain session timer ("Drawing for 6:12") and one line comparing it to the measured drawing time ("Usually takes 8 min"). No charts. Timer text turns orange past the average and red past 1.5× | MVP |
| I4 | **Finish & call next** in one tap | MVP |
| I5 | **Waiting list**: every waiting ticket in queue order, with name, notes, and how long they've waited. Read-only — no drag-to-reorder (see A8, Admin only) | MVP |
| I5a | **New ticket** (same flow as A2–A4): a floating **+ New Ticket** button opens the same form, duplicate check, and full-screen QR as Admin's | MVP |
| I6 | **Not here** menu on a called customer: mark no-show, or put them back 2 places | MVP |
| I7 | **Recall**: re-alerts the customer page ("It's your turn" takeover shows again) | MVP |
| I9 | **Break**: pause for 5 / 10 / 15 / custom minutes or untimed. Customers see a break banner and ETAs include the break. Resume button | MVP |
| I10 | Stats strip: served today, average session, waiting count, **projected finish time for everyone in line** (helps decide when to stop taking tickets) | MVP |
| I11 | Stop-accepting-tickets toggle (same as A11) | MVP |
| I12 | Screen stays awake while the console is open (Screen Wake Lock API, with a visible indicator) | MVP |
| I13 | Buttons disable while a request is in flight; haptic tap feedback where supported; confirmation for no-show | MVP |
| I14 | **Undo** last action via a toast for 10 s (accidental Finish or Call next) | P1 |
| I15 | Public display screen `/display` for a tablet or TV at the booth: now serving + next numbers | P1 |
| I16 | **Draw from photo**: customers who can't stay leave a photo (taken or chosen from the library); the illustrator draws from it and the customer collects the portrait later, with a "Ready for pickup" step. Full spec in `PHOTO_TICKETS.md` | P1 |
| I16b | Snap a photo of the finished portrait and attach it to the ticket (portfolio, or shown on the customer's Done page) | P2 |
| I17 | Multiple illustrators, each with their own current ticket | P2 |

### Look and feel (all roles)

| ID | Feature | Priority |
|---|---|---|
| L1 | iOS 27 visual style on every screen: system font (SF Pro on Apple devices, Inter elsewhere), large titles, inset grouped lists, capsule buttons, frosted-glass toolbars and floating bars. Details in `UI.md` → Visual style | MVP |
| L2 | Light and dark mode that **automatically follow the device setting**, including switching live while a page is open. No in-app toggle | MVP |

## Non-functional requirements

- **Performance**: customer page usable in under 2 s on 4G; polling payload under 2 KB.
- **Reliability**: every mutation is safe to double-tap (server rejects the second with a clear 409 and the UI refreshes).
- **Privacy**: phone numbers visible only to staff; customer links are unguessable; no analytics trackers on the customer page.
- **Accessibility**: WCAG AA contrast in both light and dark schemes, readable in sunlight (large numerals), works with system font scaling, respects Reduce Transparency and Increase Contrast.
- **Browsers**: latest iOS Safari and Android Chrome are the priority.
