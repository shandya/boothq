import { buildTicketLinkMessage, buildWhatsAppUrl } from "@boothq/shared";
import type { ReactNode } from "react";

type WhatsAppButtonProps = {
  phone: string; // E.164
  firstName: string;
  number: number;
  boothName: string;
  url: string;
  children: ReactNode;
  className?: string;
};

// Builds a tap-to-send WhatsApp link (docs/UI.md → Shared components).
export function WhatsAppButton({ phone, firstName, number, boothName, url, children, className }: WhatsAppButtonProps) {
  const text = buildTicketLinkMessage({ firstName, number, boothName, url });
  const href = buildWhatsAppUrl(phone, text);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
