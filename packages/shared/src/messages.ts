// Builds a tap-to-send WhatsApp link that opens the sender's own WhatsApp
// with a prefilled message (v1 has no automatic sending, see docs/PRD.md).
// Not used by the MVP (see CLAUDE.md history); kept for Phase 8's
// "Ready for pickup" WhatsApp button (docs/PHOTO_TICKETS.md), which
// supplies its own message text.
export function buildWhatsAppUrl(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const messages = {
  readyForPickup: (v: { firstName: string; number: number; booth: string }) =>
    `Hi ${v.firstName}! Your portrait (#${v.number}) from ${v.booth} is ready. Pick it up at the booth any time before we close.`,
};
