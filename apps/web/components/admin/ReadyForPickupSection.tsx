"use client";

import { buildWhatsAppUrl, messages, type TicketDTO } from "@boothq/shared";
import { Camera, MessageCircle } from "lucide-react";
import { usePickedUp } from "../../lib/queries";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";

const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

// Opens the admin's own WhatsApp with the "it's ready" message prefilled
// (v1 has no automatic sending). Hidden when the phone number is gone.
export function ReadyWhatsAppButton({ ticket, row = false }: { ticket: TicketDTO; row?: boolean }) {
  if (!ticket.phone) return null;
  const href = buildWhatsAppUrl(
    ticket.phone,
    messages.readyForPickup({
      firstName: ticket.name.split(/\s+/)[0] ?? ticket.name,
      number: ticket.number,
      booth: boothName,
    }),
  );
  if (row) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex h-[50px] w-full items-center gap-3 px-4 text-[17px] text-link"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        Send &ldquo;It&apos;s Ready&rdquo; on WhatsApp
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Tell ${ticket.name} their portrait is ready on WhatsApp`}
      className="flex h-11 w-11 shrink-0 items-center justify-center shape-sq bg-fill text-link"
    >
      <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
    </a>
  );
}

type ReadyForPickupSectionProps = {
  tickets: TicketDTO[];
  onRowClick?: (ticketId: string) => void; // omitted where there's no ticket sheet (booth closed)
  onToast: (message: string) => void;
};

export function ReadyForPickupSection({ tickets, onRowClick, onToast }: ReadyForPickupSectionProps) {
  const pickedUp = usePickedUp();
  if (tickets.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="m-0 mt-1.5 px-4 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
        Ready for pickup &middot; {tickets.length}
      </h2>
      <GroupedList>
        {tickets.map((ticket, index) => (
          <div key={ticket.id}>
            {index > 0 ? <GroupedSeparator inset={70} /> : null}
            <GroupedRow minHeight={62} className="py-2 pl-3.5 pr-3">
              <button
                type="button"
                onClick={() => onRowClick?.(ticket.id)}
                disabled={!onRowClick}
                className="flex min-w-0 flex-grow cursor-pointer items-center gap-3 bg-transparent p-0 text-left disabled:cursor-default"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center shape-sq bg-status-green-bg text-[17px] font-bold tabular-nums text-status-green-fg">
                  {ticket.number}
                </span>
                <span className="flex min-w-0 flex-grow items-center gap-1.5 truncate text-[17px] font-semibold">
                  {ticket.name}
                  <Camera className="h-[13px] w-[13px] shrink-0 text-label-2" strokeWidth={2} aria-label="Drawn from photo" />
                </span>
              </button>
              <ReadyWhatsAppButton ticket={ticket} />
              <button
                type="button"
                disabled={pickedUp.isPending}
                onClick={() => pickedUp.mutate(ticket.id, { onSuccess: () => onToast(`#${ticket.number} picked up`) })}
                className="h-11 shrink-0 cursor-pointer shape-sq bg-accent px-3.5 text-[15px] font-semibold text-on-accent disabled:cursor-default disabled:opacity-50"
              >
                Picked Up
              </button>
            </GroupedRow>
          </div>
        ))}
      </GroupedList>
    </div>
  );
}
