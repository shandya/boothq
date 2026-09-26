# Draw From Photo (after MVP)

Some customers can't stay for a live drawing. Staff take a photo of them (or pick one from the phone's library), the illustrator draws from it when their turn comes, and the customer collects the finished portrait later.

Build this **after the MVP ships** (Phase 8 in `IMPLEMENTATION_PLAN.md`). Design reference: the "Draw from photo" rows on the Claude Design canvas.

## User stories

**Rule: a photo on the ticket means it's a virtual session.** There is no separate switch. Adding a photo makes the ticket virtual; removing it (before drawing starts) makes it in-person again.

- As an admin creating a ticket, I optionally take a photo or choose one from the library. With a photo, the ticket is virtual; without one, it's in-person. The note field is available either way.
- As an admin, if an in-person customer comes back and says they can't wait after all, I add a photo from the ticket sheet (**Add Photo**) and the ticket becomes virtual.
- As the illustrator, virtual tickets start directly when their turn comes (no calling or waiting for someone to walk up).
- As a customer with a photo ticket, my page says "We're drawing you from your photo", shows an **estimated ready time**, and changes to **"Your portrait is ready!"** when it's finished. I get no "head back" banner or "It's your turn" takeover.
- As an admin, I see a **Ready for pickup** list with a WhatsApp "it's ready" button and a **Picked Up** button for each portrait.

## Data model changes

```prisma
enum TicketMode {
  IN_PERSON
  FROM_PHOTO
}

enum TicketStatus {
  WAITING
  CALLED
  SERVING
  READY      // NEW: FROM_PHOTO drawing finished, waiting for pickup
  DONE
  NO_SHOW
  CANCELLED
}

model Ticket {
  // ...existing fields
  mode            TicketMode @default(IN_PERSON)
  photoPath       String?    // storage pathname; null = no photo
  photoUploadedAt DateTime?
  readyAt         DateTime?  // FROM_PHOTO finish time
  pickedUpAt      DateTime?
}
```

`mode` is never set by staff directly. The service sets it: confirming a photo upload sets `FROM_PHOTO`, deleting the photo while the ticket is still WAITING or CALLED sets `IN_PERSON`. The column is kept (rather than deriving from `photoPath`) because the photo is deleted after drawing, but READY/DONE tickets and stats still need to know the session was virtual.

### State machine additions

| From | To | Action | Rule |
|---|---|---|---|
| WAITING (FROM_PHOTO) | SERVING | `call-next` | Photo tickets skip CALLED: call-next starts them directly |
| WAITING (FROM_PHOTO) | SERVING | `start` | Allowed **out of order** when no ticket is current, so the illustrator can fill a gap |
| CALLED (FROM_PHOTO) | SERVING | `start` | Happens when a photo is added to a ticket that was already called; normal start |
| SERVING (FROM_PHOTO) | READY | `finish` | Sets `readyAt`, `durationSec`; deletes the photo |
| READY | DONE | `picked-up` | Sets `pickedUpAt` |

### Invariant updates (`DATA_MODEL.md`)

- Invariant 5 becomes: `durationSec` is set if and only if status is `READY` or `DONE`.
- New: while a ticket is WAITING, CALLED or SERVING, `mode = FROM_PHOTO` if and only if `photoPath` is non-null.
- READY tickets don't count as the current ticket and have no position.

## Business logic changes

- **ETA**: photo durations count toward the day's average like any other session (use READY and DONE durations). The customer ETA for a FROM_PHOTO ticket is the *ready* time: `etaSec + avgSessionSec`.
- **Heads-up**: `almostUp` is always false for FROM_PHOTO tickets.
- **Close day**: READY tickets are **not** cancelled; they stay READY so pickups can be recorded later from Day history. The close-day summary shows "N portraits waiting for pickup". WAITING/CALLED photo tickets are cancelled like any other.
- **Stats**: add `readyForPickupCount`.

## Photo storage

### Where

Vercel Blob, **private** store, in the same Vercel account. Wrap it behind a small interface so it can be swapped for Cloudflare R2 or Supabase Storage later without touching the rest of the code:

```ts
// apps/api/src/lib/photo-storage.ts
interface PhotoStorage {
  createUploadToken(pathname: string, maxBytes: number): Promise<{ clientToken: string }>;
  exists(pathname: string): Promise<boolean>;
  read(pathname: string): Promise<{ body: ReadableStream; contentType: string }>;
  delete(pathnames: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}
```

Pathname scheme: `days/{dayId}/{ticketId}-{nanoid(8)}.jpg`. The per-day prefix lets close-day and clean-up delete everything for a day in one call.

### Upload flow (never through the API)

Vercel Functions reject request bodies over 4.5 MB, so the image goes straight from the phone to storage:

1. **Pick**: two buttons: **Take Photo** (`<input type="file" accept="image/*" capture="environment">`) and **Choose from Library** (same input without `capture`).
2. **Shrink on the phone**: decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`, draw to a canvas at max 1600px on the long edge, export `image/jpeg` at quality 0.8 (target 200–400 KB). Re-encoding also strips EXIF metadata, including GPS location. If decoding fails (rare HEIC edge cases), show "Couldn't read this photo, try taking a new one."
3. **Get a token**: `POST /api/tickets/:id/photo/upload-token` → `{ pathname, clientToken }`. The token only allows that exact pathname, `image/jpeg`, max 1 MB.
4. **Upload**: the browser uploads the blob directly to Vercel Blob with the client token (`@vercel/blob/client` `put`). Show a progress bar; allow retry.
5. **Confirm**: `POST /api/tickets/:id/photo { pathname }`. The API checks the object exists, deletes any previous photo for that ticket, and saves `photoPath`. Don't rely on storage upload callbacks; they don't reach localhost and the explicit confirm is simpler.

### Viewing

`GET /api/tickets/:id/photo` (staff only) streams the image through the API with `Cache-Control: private, max-age=300`. Photos are ~300 KB, well within function limits. Customers never get a photo URL.

### Deleting (privacy)

Photos of faces are personal data, so keep them only as long as needed:

- When a FROM_PHOTO ticket is **finished** (→ READY), since the drawing no longer needs it.
- When a ticket is **cancelled or removed**, or its photo is **replaced**.
- On **close day**: `deletePrefix('days/{dayId}/')` removes anything left, including uploads that were never confirmed.
- Admin can delete a photo manually from the ticket sheet.

## API additions (`API.md`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/api/tickets` | admin | unchanged (name, phone, notes) | The ticket is created in-person; the client then uploads and confirms the photo, which switches it to FROM_PHOTO. The New ticket sheet does both in one tap (create → upload → confirm → show QR) |
| POST | `/api/tickets/:id/photo/upload-token` | staff | — | `{ pathname, clientToken }` |
| POST | `/api/tickets/:id/photo` | staff | `{ pathname }` | confirm; sets `mode = FROM_PHOTO`; allowed while WAITING or CALLED; returns `{ ticket, snapshot }` |
| GET | `/api/tickets/:id/photo` | staff | — | image stream; 404 if none |
| DELETE | `/api/tickets/:id/photo` | admin | — | allowed while WAITING or CALLED; sets `mode = IN_PERSON`. `409 INVALID_TRANSITION` while SERVING |
| POST | `/api/tickets/:id/picked-up` | staff | — | READY → DONE |

DTO changes: `TicketDTO` gains `mode`, `hasPhoto`, `readyAt`, `pickedUpAt`. `QueueSnapshot` gains `readyForPickup: TicketDTO[]`. `PublicTicketView` gains `mode` and `readyEta` (for FROM_PHOTO: `{ estimatedAt, sec }`), and `status` may be `READY`.

No new error codes.

## UI changes (`UI.md`)

- **Admin → New ticket sheet**: Name, Phone, then a **Photo · optional** group (Take Photo / Choose from Library; after picking, a thumbnail with Retake / Choose from Library / Remove) with the footer "Adding a photo makes this a virtual session: we draw from the photo and they pick up the portrait later. The photo is deleted once the drawing is done." The **Note** field stays below it, as in the MVP sheet. If a photo was picked, Create waits for the upload to finish.
- **Admin → Ticket sheet**: **Add Photo** (in-person tickets) or **View Photo** / **Remove Photo** (virtual tickets, before drawing starts).
- **Admin → Queue**: a **Ready for pickup** section above Now, each row with a WhatsApp "it's ready" button and a **Picked Up** capsule. Photo tickets show a small camera icon next to the name.
- **Illustrator → Now card (FROM_PHOTO)**: a "Drawing from photo" chip, the photo large (tap for full screen with pinch-zoom), notes, and a compact "Drawing for 4:05" line. Helper text under the buttons: "Finishing tells {name} their portrait is ready for pickup."
- **Illustrator → Up next**: photo tickets show a camera icon; the primary button reads "Start #11 Ana (from photo)" instead of "Call".
- **Customer (FROM_PHOTO, WAITING/SERVING)**: blue info banner "We're drawing you from your photo", chip "In line · from photo", and an **Estimated ready** card instead of Estimated wait.
- **Customer (READY)**: green "Your Portrait Is Ready!" screen with the big number, "Pick it up at the booth any time before we close", and the booth closing time.

WhatsApp template (`packages/shared/src/messages.ts`):

```ts
readyForPickup: "Hi {firstName}! Your portrait (#{number}) from {booth} is ready. Pick it up at the booth any time before we close."
```

## Free-tier and cost notes

- Vercel Blob has a free allowance on the Hobby plan. At ~300 KB per photo, deleted after drawing, storage stays tiny. Uploads count as Blob operations; check the current Hobby allowance in the Vercel dashboard.
- **Vercel's Hobby plan is for personal, non-commercial use only.** It's fine for building and testing. Before taking paying customers, move to Vercel Pro or another host whose free tier allows commercial use. No code changes are needed either way.

## Env and dependencies

- API env: `BLOB_READ_WRITE_TOKEN` (created by linking a Blob store to the API's Vercel project).
- API dependency: `@vercel/blob`. Web dependency: `@vercel/blob` (client upload helper only).

## Tests

- State machine: every new transition, plus rejects (READY can't be called; photo can't be removed while SERVING).
- Confirming a photo sets `mode = FROM_PHOTO`; deleting it before drawing sets `IN_PERSON`.
- call-next on a FROM_PHOTO ticket goes straight to SERVING.
- Out-of-order `start` of a photo ticket only when nothing is current.
- Finish on FROM_PHOTO → READY, `readyAt` set, storage `delete` called.
- Close day keeps READY, cancels the rest, calls `deletePrefix`.
- Public view: FROM_PHOTO has `almostUp: false`, a `readyEta`, and never a photo URL.
- Use an in-memory `PhotoStorage` fake in tests.
