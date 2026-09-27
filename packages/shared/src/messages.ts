// WhatsApp message templates (docs/ARCHITECTURE.md → Shared components,
// docs/UI.md → WhatsApp message templates).

export type TicketLinkMessageInput = {
  firstName: string;
  number: number;
  boothName: string;
  url: string;
};

export function buildTicketLinkMessage({ firstName, number, boothName, url }: TicketLinkMessageInput): string {
  return `Hi ${firstName}! You're #${number} at ${boothName}. Track your place in line here: ${url}`;
}

// Builds a tap-to-send WhatsApp link that opens the sender's own WhatsApp
// with a prefilled message (v1 has no automatic sending, see docs/PRD.md).
export function buildWhatsAppUrl(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
