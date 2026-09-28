"use client";

import type { TicketDTO } from "@boothq/shared";
import { formatDuration } from "@boothq/shared/format";
import { Pen } from "lucide-react";
import { useState } from "react";
import { getServerNow } from "../../lib/server-time";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";
import { TicketNoteSheet } from "./TicketNoteSheet";

function waitedLabel(ticket: TicketDTO): string {
  const sec = Math.max(0, Math.round((getServerNow().getTime() - new Date(ticket.createdAt).getTime()) / 1000));
  return `Waited ${formatDuration(sec)}`;
}

// Every WAITING ticket, in queue order; read-only (no drag handle, no
// Reorder action — reordering stays on the Admin's Waiting section)
// (docs/UI.md → Illustrator: /illustrator, Waiting list).
export function WaitingList({ tickets }: { tickets: TicketDTO[] }) {
  const [noteTicket, setNoteTicket] = useState<TicketDTO | null>(null);

  if (tickets.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="m-0 mt-1.5 px-4 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
        Waiting &middot; {tickets.length}
      </h2>
      <GroupedList>
        {tickets.map((ticket, index) => (
          <div key={ticket.id}>
            {index > 0 ? <GroupedSeparator inset={70} /> : null}
            <GroupedRow minHeight={62} onClick={() => setNoteTicket(ticket)}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill text-[17px] font-bold tabular-nums">
                {ticket.number}
              </span>
              <span className="flex min-w-0 flex-grow flex-col gap-0.5">
                <span className="flex items-center gap-1.5 truncate text-[17px] font-semibold">
                  {ticket.name}
                  {ticket.notes ? (
                    <Pen className="h-[13px] w-[13px] shrink-0 text-label-2" strokeWidth={2} aria-label="Has a note" />
                  ) : null}
                </span>
                <span className="truncate text-[13px] text-label-2">{waitedLabel(ticket)}</span>
              </span>
            </GroupedRow>
          </div>
        ))}
      </GroupedList>
      {noteTicket ? <TicketNoteSheet ticket={noteTicket} onClose={() => setNoteTicket(null)} /> : null}
    </div>
  );
}
