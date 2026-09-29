"use client";

import type { TicketDTO } from "@boothq/shared";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { useUpdateTicket } from "../../lib/queries";
import { CapsuleButton } from "../ui/CapsuleButton";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";

export function EditTicketSheet({ ticket, onClose }: { ticket: TicketDTO; onClose: () => void }) {
  const [name, setName] = useState(ticket.name);
  const [phone, setPhone] = useState(ticket.phoneDisplay ?? ticket.phone ?? "");
  const [notes, setNotes] = useState(ticket.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateTicket();

  function save() {
    setError(null);
    mutation.mutate(
      { id: ticket.id, input: { name, phone, notes: notes || undefined } },
      {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Sheet title="Edit Ticket" onClose={onClose}>
      <GroupedList>
        <div className="flex h-[52px] items-center gap-3 px-4">
          <label htmlFor="et-name" className="w-16 text-[17px]">
            Name
          </label>
          <input
            id="et-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none"
          />
        </div>
        <GroupedSeparator />
        <div className="flex h-[52px] items-center gap-3 px-4">
          <label htmlFor="et-phone" className="w-16 text-[17px]">
            Phone
          </label>
          <input
            id="et-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none"
          />
        </div>
      </GroupedList>
      <GroupedList>
        <div className="min-h-16 px-4 py-3.5">
          <label htmlFor="et-notes" className="sr-only">
            Note for the illustrator
          </label>
          <input
            id="et-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Note (optional)"
            className="w-full border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
          />
        </div>
      </GroupedList>
      {error ? <p className="m-0 px-1 text-[15px] text-danger">{error}</p> : null}
      <CapsuleButton onClick={save} pending={mutation.isPending}>
        Save Changes
      </CapsuleButton>
    </Sheet>
  );
}
