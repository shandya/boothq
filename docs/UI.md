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

## Visual style: iOS 27 look (MVP)

The app should feel like a native iOS 27 app: Apple's system colors, large titles, inset grouped lists, capsule buttons, and translucent "Liquid Glass" toolbars and floating bars.

### Typography

- Font stack everywhere: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif`. iPhones and Macs get the real San Francisco font; every other device gets **Inter**, the Google Font closest to SF Pro.
- Load Inter with `next/font/google` (variable, `opsz` + `wght` axes, `display: swap`) and put its CSS variable after the Apple fonts in the stack.
- Type scale (px / weight): Large Title 34/700 (tracking -0.02em) · Title 28/700 · Title 3 20/600 · Headline 17/600 · Body 17/400 · Subhead 15/400 · Footnote 13/400 · Caption 12/600. Section headers above grouped lists: 13/600, uppercase, secondary label color.
- Ticket numbers: weight 700, `font-variant-numeric: tabular-nums`, tracking -0.045em. Timers also use tabular numbers.
- Button labels use Title Case ("Start Drawing", "Copy Link").

### Components

- **Inset grouped lists**: rounded containers (radius 24px) on the grouped background, 1px separators inset past the leading icon, 50–64px rows.
- **Cards**: radius 28px; stat tiles radius 20px.
- **Buttons**: capsules (`border-radius: 999px`). Primary = accent fill, white text, 56–60px tall. Secondary = gray fill with link-colored text, 52px. Destructive = danger-colored text in its own grouped row.
- **Glass surfaces**: top-bar icon buttons (44px circles), floating bottom bars and pills use the glass tokens with `backdrop-filter: blur(24px) saturate(180%)`. Provide a solid fallback (`@supports not (backdrop-filter: blur(1px))` → use `--card`) and honor `prefers-reduced-transparency: reduce` and `prefers-contrast: more` by switching glass to solid `--card`.
- **Sheets**: float 8px in from the screen edges with 38px corner radius, a glass close (✕) button on the left and a confirm action on the right.
- **Segmented controls, switches, search field**: iOS style (capsule segmented control on a gray fill; 51×31 green switch; capsule search field).
- **Icons**: SF Symbols look: 2px stroke, rounded caps. Use `lucide-react` in the app.
- Minimum touch target 44×44px.

### Color: follows the device (MVP)

The app follows the phone's light/dark setting automatically. There is no in-app toggle. Implement with CSS custom properties defined on `:root` and redefined under `@media (prefers-color-scheme: dark)`; add `color-scheme: light dark` on `:root` and two `<meta name="theme-color">` tags (one per scheme) so the browser chrome matches. Tailwind uses these variables (`darkMode: 'media'`). Switching the phone's appearance while a page is open must update it immediately with no reload.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F2F2F7` | `#000000` | Page (grouped) background |
| `--card` | `#FFFFFF` | `#1C1C1E` | Cards, grouped lists |
| `--sheet` / `--cell` | `#F2F2F7` / `#FFFFFF` | `#1C1C1E` / `#2C2C2E` | Sheet background / rows inside sheets |
| `--fill` | `#E9E9EE` | `#2C2C2E` | Secondary buttons, number circles, search field |
| `--label` | `#000000` | `#FFFFFF` | Primary text |
| `--label-2` | `#6C6C70` | `#AEAEB2` | Secondary text (AA contrast on both backgrounds) |
| `--separator` | `#D1D1D6` | `#38383A` | List separators |
| `--accent` | `#0071E3` | `#0071E3` | Primary button fill (white text passes AA) |
| `--link` | `#0066CC` | `#409CFF` | Text buttons, links, tinted icons |
| `--danger` | `#D70015` | `#FF6961` | Destructive text |
| `--switch-on` | `#248A3D` | `#30D158` | Switches, live dots |
| `--glass` | `rgba(255,255,255,.72)` | `rgba(38,38,40,.72)` | Glass surfaces |
| `--glass-edge` | `rgba(255,255,255,.95)` | `rgba(255,255,255,.14)` | Glass 1px border |
| `--dim` | `rgba(0,0,0,.3)` | `rgba(0,0,0,.55)` | Backdrop behind sheets |

Status chips (background / text):

| Status | Light | Dark |
|---|---|---|
| WAITING, NO_SHOW, CANCELLED (gray) | `#E5E5EA` / `#3C3C43` | `#2C2C2E` / `#EBEBF5` |
| CALLED (orange) | `#FFF0DB` / `#B04A00` | `#3A2400` / `#FFB340` |
| SERVING (blue) | `#E3EFFF` / `#0058B0` | `#0B2745` / `#7CB9FF` |
| DONE, Open (green) | `#E3F5E7` / `#1B7A34` | `#0D2E17` / `#4ADE7B` |

Exceptions: the customer "It's your turn" takeover is solid `--accent` with white text in both schemes, and the QR code always sits on a white card with black modules (scanners need dark-on-light), even in dark mode.

## Shared components

`TicketNumber`, `StatusChip`, `BottomSheet`, `ConfirmSheet`, `QrFullscreen`, `ElapsedTimer` (uses server offset), `OfflineBanner`, `Toast`, `WhatsAppButton` (builds `https://wa.me/<digits>?text=<encoded>` from templates in `packages/shared/src/messages.ts`).

### WhatsApp message templates

```ts
ticketLink:  "Hi {firstName}! You're #{number} at {booth}. Track your place in line here: {url}"
```

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
│  Based on today's average    │
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

**No open day**: centered card "Booth is closed" + **Open booth** button → sheet with "Typical drawing time" (minutes, default 10), "Time between customers" (minutes, default 1), and "Tell customers to head back when ___ people are ahead" (stepper, default 3, 0 = off).

**Open day layout**

- **Header**: booth status chip (Open / On break / Not accepting), waiting count, average session, menu (Illustrator view, Settings, Close booth, Log out).
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
- Buttons: **Send via WhatsApp** (ticketLink template), **Copy link**, **Done**.

**Ticket sheet** (from a row)

- Number, name, phone (tap to call), notes, status, created / called / started times.
- Actions by status:
  - Always: **Show QR**, **Send link via WhatsApp**, **Edit**, **Regenerate link** (confirm: "The old link will stop working").
  - WAITING: **Remove**. (Reordering happens from the Waiting list itself, not from this sheet — see below.)
  - CALLED / NO_SHOW: the same staff actions as the illustrator (start, requeue, no-show).
  - CALLED: **Remove**.

**Settings sheet**: typical drawing time, time between customers, heads-up threshold, accepting tickets toggle.

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
│ UP NEXT                      │
│  #10 Budi   waited 22m       │
│  #11 Ana    waited 18m       │
│  #12 Rio    waited 10m       │
├─────────────────────────────┤
│ [☕ Break]  [Accepting: ON]  │
└─────────────────────────────┘
```

**Now card by state**

| State | Content | Primary | Secondary |
|---|---|---|---|
| No current, queue has people | "Next up: #10 Budi" | **Call #10 Budi** | Start directly (small link) |
| No current, queue empty | "No one waiting" | — | — |
| CALLED | Number, name, notes, "called 2 min ago (×2)" | **Start drawing** | **Recall** (re-alerts the customer page only), **Not here** → sheet: *Put back 2 places* / *Mark no-show* |
| SERVING | "Drawing for" + big plain timer (72px, tabular numbers) + "Usually takes 8 min today". No ring or chart. Timer text turns orange past the average and `--danger` past 1.5× | **Finish & call next** | **Finish** |
| On break | "On break until 15:10" / "On break" + elapsed | **Resume** | — |

**Up next**: next 3 WAITING tickets (number, name, notes, waited time). No message buttons; customers are nudged by the heads-up banner on their own page. Tap a row for notes.

**Break sheet**: 5 / 10 / 15 / 30 min / Custom / Until I'm back, optional reason. Disabled while SERVING with hint "Finish the current drawing first".

**Feedback**: every mutation button shows a pending state and is disabled until the response arrives; `navigator.vibrate(10)` on success where supported; on 409, toast "Already updated" and apply `details.snapshot`.

**P1**: Undo toast for 10 s after Call next / Start / Finish / No-show.

Admins see an extra "Admin" link in the header.

---

## Display (P1): `/display`

Landscape, full-screen, no auth. Polls `GET /api/public/now-serving` every 5 s. Huge "Now serving #9", smaller "Next: 10 · 11 · 12", break banner, booth name. Shows no names.
