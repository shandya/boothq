# UI Screens

## Design principles

- Phone first (375px). Everything must also work on a tablet or desktop, but don't design for them first.
- **Big numbers.** Ticket numbers are the hero element everywhere: 96px+ on the customer page, 64px on staff "Now" cards.
- Primary actions are full-width capsule buttons in the bottom half of the screen. Secondary actions go in bottom sheets, never hover menus.
- One primary action per state. The illustrator should never have to think about which button to press.
- Destructive actions (remove, no-show, close booth, regenerate link) need a confirmation sheet that names the customer: "Mark #12 Sarah as no-show?"
- Loading: skeletons, not spinners, on first load; background refetches are silent.
- Offline: a thin banner "Offline — showing info from 14:32" and disabled mutation buttons.
- Booth name from `NEXT_PUBLIC_BOOTH_NAME` in headers.
- The design reference is the Claude Design canvas "BoothQ" (light and dark rows for every screen): <https://claude.ai/artifact/F1etBuSDFs6pshetBxHvti>. Match it.

## Visual style: iOS 27 layout, Londrina + blue/mustard palette (MVP)

The app should feel like a native iOS 27 app: Apple's system colors, large titles, inset grouped lists, capsule buttons, and translucent "Liquid Glass" toolbars and floating bars.

### Typography

- Font: **Londrina Solid** (Google Font) everywhere, loaded with `next/font/google` at weights 100 and 400 only (`display: swap`), exposed as `--font-londrina`. Body copy is **Thin 100**; titles, headings, buttons, chips and numbers are **Regular 400**. The font has no bold, so Tailwind's `font-medium/semibold/bold` all resolve to 400 and `font-normal` to 100.
- Type scale (px / weight): Large Title 34/400 · Title 28/400 · Title 3 20/400 · Headline 17/400 · Body 17/100 · Subhead 15/100 · Footnote 13/100 · Caption 12/400. Section headers above grouped lists: 13/400, uppercase, secondary label color.
- Ticket numbers: weight 400, `font-variant-numeric: tabular-nums`. Timers also use tabular numbers.
- Button labels use Title Case ("Start Drawing", "Copy Link").

### Components

- **Organic shapes**: everything is square-ish with a small, slightly uneven radius (6–16px, never pills or circles): `.shape-card` (cards, lists), `.shape-tile`, `.shape-btn` (buttons), `.shape-sq` (keypad keys, icon buttons, chips, switches, number badges, steppers), `.shape-modal`. Each has 2–3 variants cycled by position so neighbours differ. Add `.sticker` for the 2px `--outline` border and 3px/4px solid offset shadow (pressed state shifts it). Only spinners and tiny status dots stay round. A faint SVG paper-grain sits on the page background. The QR code sits on a white `.shape-card`; tap targets stay ≥44px.
- **Grouped lists**: organic-shaped containers on the page background, 1px separators inset past the leading icon, 50–64px rows.
- **Cards**: `.shape-card`; stat tiles `.shape-tile`.
- **Buttons**: small-radius rounded squares. Primary = `--accent` (blue) fill, `.shape-btn .sticker`, `--on-accent` text, 56–60px tall. Secondary = gray fill with link-colored text, 52px. Destructive = `--danger` fill with `--on-danger` text (e.g. Remove in confirm dialogs).
- **Glass surfaces**: top-bar icon buttons (44px circles), floating bottom bars and pills use the glass tokens with `backdrop-filter: blur(24px) saturate(180%)`. Provide a solid fallback (`@supports not (backdrop-filter: blur(1px))` → use `--card`) and honor `prefers-reduced-transparency: reduce` and `prefers-contrast: more` by switching glass to solid `--card`.
- **Modals**: every dialog is built on `components/ui/Modal.tsx`: centered on screen (never bottom sheets), 24px side margin, max 380px wide, `.shape-modal .sticker` on `--sheet`, 20px title centered, dimmed backdrop (`--dim`). Form dialogs (`Sheet`) add a ✕ on the left and an optional confirm action on the right. Alerts (`ConfirmSheet`, `NotHereSheet`, `TicketNoteSheet`) put their actions as full-width stacked capsule buttons in the footer: primary/destructive first, Cancel last. New dialogs must use `Modal`, not hand-rolled overlays.
- **Segmented controls, switches, search field**: iOS style (capsule segmented control on a gray fill; 51×31 green switch; capsule search field).
- **Icons**: SF Symbols look: 2px stroke, rounded caps. Use `lucide-react` in the app.
- Minimum touch target 44×44px.

### Color: follows the device (MVP)

The app follows the phone's light/dark setting automatically. There is no in-app toggle. Implement with CSS custom properties defined on `:root` and redefined under `@media (prefers-color-scheme: dark)`; add `color-scheme: light dark` on `:root` and two `<meta name="theme-color">` tags (one per scheme) so the browser chrome matches. Tailwind uses these variables (`darkMode: 'media'`). Switching the phone's appearance while a page is open must update it immediately with no reload.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#E9F3F5` | `#1C211F` | Page (grouped) background |
| `--card` | `#F7FBFC` | `#242C2D` | Cards, grouped lists |
| `--sheet` / `--cell` | `#E9F3F5` / `#F7FBFC` | `#242C2D` / `#2F393B` | Sheet background / rows inside sheets |
| `--fill` | `#C9E4EA` | `#33474C` | Secondary buttons, number circles, search field |
| `--label` | `#1C211F` | `#EEE8E5` | Primary text |
| `--label-2` | `#4C5A5E` | `#B4BFC1` | Secondary text (AA contrast on both backgrounds) |
| `--separator` | `#CDDFE3` | `#37454A` | List separators |
| `--accent` | `#2A6F80` | `#91C8D3` | **Primary** (blue): primary button fill, selected states |
| `--on-accent` | `#FFFFFF` | `#1C211F` | Text/icons on `--accent` |
| `--pop` | `#EBAC1F` | `#EBAC1F` | **Accent** (mustard): "your turn" takeover, "You" circle, floating action button |
| `--on-pop` | `#1C211F` | `#1C211F` | Text/icons on `--pop` (white fails AA on mustard) |
| `--link` | `#1F5F70` | `#91C8D3` | Text buttons, links, tinted icons |
| `--danger` | `#B3261E` | `#FF8F85` | Destructive fill and text |
| `--on-danger` | `#FFFFFF` | `#1C211F` | Text on `--danger` fill |
| `--switch-on` | `#4F9FAE` | `#91C8D3` | Switches, live dots |
| `--glass` | `rgba(233,243,245,.72)` | `rgba(36,44,45,.72)` | Glass surfaces |
| `--glass-edge` | `rgba(255,255,255,.9)` | `rgba(238,232,229,.14)` | Glass 1px border |
| `--dim` | `rgba(28,33,31,.35)` | `rgba(0,0,0,.55)` | Backdrop behind sheets |
| `--outline` | `#086385` | `#4A9DBB` | `.sticker` border and offset shadow |

Palette source: sky blue `#91C8D3` (primary family, with a deeper blue `#2A6F80` derived for light-mode buttons/links), mustard `#EBAC1F` (accent), peach `#EFD0AF`, ink `#1C211F`, paper `#EEE8E5`. Dark scheme uses ink as the background and the sky blue as primary.

Status chips (background / text):

| Status | Light | Dark |
|---|---|---|
| WAITING, NO_SHOW, CANCELLED (gray) | `#D6E3E6` / `#3B4A4D` | `#37454A` / `#DBE6E8` |
| CALLED (orange) | `#F9E2B0` / `#6E4300` | `#3D2C08` / `#F3BF52` |
| SERVING (blue) | `#BFE0E8` / `#174F5E` | `#1F4650` / `#B5DFE8` |
| DONE, Open (green) | `#DBE9D6` / `#2A6535` | `#1F3421` / `#9FD39B` |

Exceptions: the customer "It's your turn" takeover is solid `--pop` with `--on-pop` text in both schemes, and the QR code always sits on a white card with black modules (scanners need dark-on-light), even in dark mode.

## Shared components

`TicketNumber`, `StatusChip`, `BottomSheet`, `ConfirmSheet`, `QrFullscreen`, `ElapsedTimer` (uses server offset), `OfflineBanner`, `Toast`.

---

## `/login`

- Segmented control: **Illustrator** | **Admin**.
- Large numeric keypad for the PIN (`inputmode="numeric"`, masked dots).
- On success redirect to `?next=` or the role's home (`/illustrator` or `/admin`).
- Error shake + "Wrong PIN". After a 429, show "Too many tries, wait a minute".

---

## Customer: `/t/[token]`

Polls `GET /api/public/tickets/:token` every 10 s.

**WAITING (default)**

```
┌─────────────────────────────┐
│  My Illustration Booth       │
│                              │
│ ┌──────────────────────────┐ │
│ │ ⌖ Start heading back to  │ │  ← heads-up banner, only when
│ │   the booth. Only 3      │ │    ≤ 3 people ahead (almostUp)
│ │   ahead · about 20 min   │ │
│ └──────────────────────────┘ │
│  Hi Sarah, your number       │
│          #12                 │
│                              │
│  Now serving  #9             │
│  3 people ahead of you       │
│                              │
│  Estimated wait              │
│  ~20–25 min · around 14:35   │
│  (9) (10) (11) (12)          │
│  Drawing  Next      You      │
│  Based on the recent average │
│  drawing time of 8 min       │
│                              │
│  Feel free to walk around —  │
│  keep this page open.        │
│                              │
│  [ Copy link ]               │
│  Updated 4 s ago             │
│                              │
│  Cancel my place (text btn)  │
└─────────────────────────────┘
```

**States**

| Status / condition | Screen |
|---|---|
| WAITING + `almostUp` | Soft orange banner at the top (location-pin icon, `role="status"`): "Start heading back to the booth" + "Only 3 people ahead of you. Your turn is in about 20 minutes." Status chip changes from "In line" to orange "Almost up". Not a takeover and not dismissible; it stays until the customer is called. Copy variants in `BUSINESS_LOGIC.md` → Heads-up. |
| CALLED | Full-screen takeover in solid `--accent` with white text: "It's your turn! Please come to the booth now", big number. Re-appears whenever `calledAt` changes (recall). Dismissible to the normal view, which keeps an orange "It's your turn" banner. |
| SERVING | "You're being drawn right now ✏️" |
| DONE | "Thanks for visiting!" + social handle (`NEXT_PUBLIC_SOCIAL_HANDLE`) |
| NO_SHOW | "We called #12 but couldn't find you. Please come to the booth and we'll fit you back in." |
| CANCELLED | "This ticket is cancelled." (customer), or "…was removed. Please ask at the booth." (admin), or "The booth has closed for today." |
| Booth on break | Banner: "The illustrator is on a short break until 15:10" (or "…a short break" if untimed; "Back any moment" once the time has passed) |
| Unknown token | "Ticket not found. If you lost your link, ask at the booth." |

**Cancel**: confirmation sheet "Give up your place (#12)? This can't be undone." → calls cancel → shows CANCELLED.

**Line strip** (inside the wait card): one circle per ticket from the one being drawn up to the customer's own, labelled "Drawing", "Next" and "You". If more than 4 people are ahead, show the first 2, a "+N" circle, then "You". No progress bars or charts.

**Tab title**: `#12 · 5 ahead`, `#12 · Head back now`, `#12 · Your turn!`, etc.

**P1**: "Turn on alerts" button that unlocks an audio chime and (Android) vibration for the CALLED transition. Language toggle.

---

## Admin: `/admin`

Polls `GET /api/queue` every 5 s.

**No open day**: centered card "Booth is closed" + **Open booth** button → sheet with "Tell customers to head back when ___ people are ahead" (stepper, default 3, 0 = off). No timing inputs: drawing time and time between customers are measured automatically (`BUSINESS_LOGIC.md` §5). The card also shows the ACTIVE Event: "{name} · Day {n}" with a small **Change** button that opens the Events sheet. With no ACTIVE Event it reads "No event running" and its button is **Start Event** (`EVENTS.md` → UI).

**Events**: **Admin menu → Events** (and **Change** on the closed card) opens the Events sheet: the ACTIVE Event on top (name, start date, Days, served, **Rename**, **End Event**), then past Events (name, date range, Days, served), and **Start New Event** at the bottom. While a Day is open, Start/End are disabled with the hint "Close the booth first." The **Start Event** sheet has a Name field (autofocus, 1–60 chars) and the footer "Wait-time estimates will start fresh for this event." plus "This ends {current name}." when one is running, in which case Start asks for confirmation first.

**Open day layout**

- **Header**: booth status chip (Open / On break / Not accepting), waiting count, average session, menu (Illustrator view, Day History, Settings, Events, Close booth, Log out).
- **Search bar**: name, phone, or number.
- **Sections**: *Now* (current ticket), *Waiting* (ordered), *Finished & cancelled* (collapsed by default).
- **Row**: number, name, status chip, "waiting 14 min" / ETA, notes icon if notes exist. Tap → Ticket sheet.
- **Reorder**: a "Reorder" text button in the Waiting section header enters reorder mode: rows show a drag handle, the ETA column and row taps are disabled, and a top bar shows Cancel / Done. Dragging a row lifts it (shadow, rounded corners) and shifts the others live, same as iOS reordering (e.g. Reminders). Tapping **Done** with a changed order opens a confirmation dialog before it's applied (see below); **Cancel** discards any drag and exits reorder mode. Reordering while a drawing is in progress is fine — it only touches the Waiting list.
- **Floating bottom button**: `+ New ticket` (always visible).

**Confirm reorder dialog** (iOS alert, shown after Done if the order changed): "Change the Order?" / a one-line summary naming the ticket that moved and what it now precedes, e.g. "Rio will move to next, ahead of Budi and Ana. This changes their estimated wait times." Two buttons: **Cancel** (returns to reorder mode with the drag intact) and **Confirm** (calls `POST /api/queue/reorder`, exits reorder mode, shows a brief "Order updated" toast). If the request comes back `409` because the queue changed underneath (someone was called or cancelled during the drag), close the dialog, refresh the list, and show "The queue changed — please reorder again" instead of applying anything.

**New ticket sheet**

- Fields: Name (autofocus, `autocapitalize="words"`), Phone (`type="tel"`, placeholder in local format), Notes (optional, collapsible).
- Create → on `DUPLICATE_ACTIVE_TICKET`: sheet "Sarah (#8) already has a ticket with this number" with **Show their QR** and **Create anyway**.
- Success → `QrFullscreen`.

**QrFullscreen**

- Page follows the device scheme; the QR itself always sits on a white rounded card with black modules, ~65% of screen width (`QRCodeSVG`, level M, quiet zone included).
- Above: `#12 · Sarah`. Below: "Scan with your phone camera".
- Buttons: **Copy link**, **Done**.

**Ticket sheet** (from a row)

- Number, name, phone (tap to call), notes, status, created / called / started times.
- Actions by status:
  - Always: **Show QR**, **Edit**, **Regenerate link** (confirm: "The old link will stop working").
  - WAITING: **Remove**. (Reordering happens from the Waiting list itself, not from this sheet — see below.)
  - CALLED / NO_SHOW: the same staff actions as the illustrator (start, requeue, no-show).
  - CALLED: **Remove**.

**Settings sheet**: accepting tickets toggle; read-only "Typical drawing time" and "Time between customers" rows (measured values from `stats`) with the footnote "Measured from the last 10 customers at this event. Used for wait-time estimates."; heads-up threshold.

**Day history**: `/admin/history`, reached from **Admin menu → Day History** and from a **Day History** link on the closed-booth card. A back button returns to `/admin`. Days are grouped under their Event's name (with "N days · M served"), newest first. Each row shows "Day {n} · {date}", the open–close times (or "Open now"), "{served} served · {no-show} no-show · {cancelled} cancelled", and "Avg drawing … · Longest wait …" when known. A 44px download button on each row exports that Day as a CSV (`API.md` → CSV format). Empty state: "No days yet". Loading and error ("Couldn't load the history" + Try Again) states as on every screen.

**Close booth**: confirm sheet listing how many waiting tickets will be cancelled → Day summary screen (served, no-shows, cancelled, average session, longest wait) → "Booth is closed".

---

## Illustrator: `/illustrator`

Polls `GET /api/queue` every 5 s. Requests a Screen Wake Lock on mount and re-requests it on `visibilitychange`; shows a small "Screen stays on" indicator (or "Tap to keep screen on" if the API is unavailable or was denied).

```
┌─────────────────────────────┐
│ ● Open   Served 7 · Avg 8m  │
│ 5 waiting · Done by ~16:40  │
├─────────────────────────────┤
│ NOW                          │
│  #9  Sarah                   │
│  "couple portrait"           │
│  ⏱ 06:12  (avg 08:00)        │
│                              │
│ [        Finish        ]     │
│ [  Finish & call next  ]     │
├─────────────────────────────┤
│ WAITING · 5                  │
│  #10 Budi   waited 22m       │
│  #11 Ana    waited 18m       │
│  #12 Rio    waited 10m       │
│  #13 ...    waited ...       │
├─────────────────────────────┤
│ [☕ Break]  [Accepting: ON]  │
└──────────────────────────(+)┘
```

A floating **+ New Ticket** button (bottom-right, above the break bar) opens the same `NewTicketSheet` → `QrFullscreen` flow as Admin's New ticket (docs/UI.md → Admin: `/admin`, New ticket sheet). It's the one ticket-write action an Illustrator can take; editing, removing, and reordering stay Admin-only (docs/PRD.md → Roles).

**Now card by state**

| State | Content | Primary | Secondary |
|---|---|---|---|
| No current, queue has people | "Next up: #10 Budi" | **Call #10 Budi** | Start directly (small link) |
| No current, queue empty | "No one waiting" | — | — |
| CALLED | Number, name, notes, "called 2 min ago (×2)" | **Start drawing** | **Recall** (re-alerts the customer page only), **Not here** → sheet: *Put back 2 places* / *Mark no-show* |
| SERVING | "Drawing for" + big plain timer (72px, tabular numbers) + "Usually takes 8 min" (the measured drawing time). No ring or chart. Timer text turns orange past the average and `--danger` past 1.5× | **Finish & call next** | **Finish** |
| On break | "On break until 15:10" / "On break" + elapsed | **Resume** | — |

**Waiting list**: every WAITING ticket, in queue order (number, name, notes, waited time). No message buttons; customers are nudged by the heads-up banner on their own page. Tap a row for notes. Read-only: no drag handle and no Reorder action — reordering stays on the Admin's Waiting section (docs/UI.md → Admin: `/admin`).

**Break sheet**: 5 / 10 / 15 / 30 min / Custom / Until I'm back, optional reason. Disabled while SERVING with hint "Finish the current drawing first".

**Feedback**: every mutation button shows a pending state and is disabled until the response arrives; `navigator.vibrate(10)` on success where supported; on 409, toast "Already updated" and apply `details.snapshot`.

**Undo**: after Call next, Start, Finish (with or without "call next") or No-show, a pill floats above the New Ticket button for 10 s: "Called #12 · **Undo**" (also on the Admin screen). Tapping it reverses that action and shows "Undone". It only shows on the phone that tapped, and disappears early if anything newer happens. These actions no longer show their own success toast; the pill replaces it. If the queue changed underneath ("Can't undo — the queue changed") nothing is reverted.

Admins see an extra "Admin" link in the header.

---

## Display (P1): `/display`

Landscape, full-screen, no auth. Polls `GET /api/public/now-serving` every 5 s. Huge "Now serving #9", smaller "Next: 10 · 11 · 12", break banner, booth name. Shows no names.
