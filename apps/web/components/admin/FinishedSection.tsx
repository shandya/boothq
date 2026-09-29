"use client";

import type { TicketDTO } from "@boothq/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useT } from "../../lib/i18n";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";
import { StatusChip } from "../ui/StatusChip";

type FinishedSectionProps = {
  tickets: TicketDTO[];
  onRowClick: (ticketId: string) => void;
};

export function FinishedSection({ tickets, onRowClick }: FinishedSectionProps) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <GroupedList>
      <GroupedRow minHeight={52} onClick={() => setOpen((v) => !v)} className="justify-between">
        <span className="text-[17px]">{t("admin.finished")}</span>
        <span className="flex items-center gap-1.5 text-label-2">
          {tickets.length}
          {open ? (
            <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
        </span>
      </GroupedRow>
      {open
        ? tickets.map((ticket) => (
            <div key={ticket.id}>
              <GroupedSeparator inset={16} />
              <GroupedRow minHeight={56} onClick={() => onRowClick(ticket.id)}>
                <span className="w-8 shrink-0 text-[15px] font-semibold tabular-nums text-label-2">#{ticket.number}</span>
                <span className="min-w-0 flex-grow truncate text-[15px]">{ticket.name}</span>
                <StatusChip status={ticket.status} />
              </GroupedRow>
            </div>
          ))
        : null}
    </GroupedList>
  );
}
