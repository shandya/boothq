"use client";

import type { TicketDTO } from "@boothq/shared";
import { Check } from "lucide-react";
import { useState } from "react";
import { useCreateTicket } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { CapsuleButton } from "../ui/CapsuleButton";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";

type NewTicketSheetProps = {
  nextNumber: number;
  onClose: () => void;
  onCreated: (ticket: TicketDTO) => void;
  onShowExisting: (ticket: TicketDTO) => void;
};

export function NewTicketSheet({ nextNumber, onClose, onCreated, onShowExisting }: NewTicketSheetProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<TicketDTO | null>(null);

  const mutation = useCreateTicket();

  async function submit(force = false) {
    setError(null);
    try {
      const result = await mutation.mutateAsync({ name, phone, notes: notes || undefined, force });
      onCreated(result.ticket);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_ACTIVE_TICKET" && err.details?.existing) {
        setDuplicate(err.details.existing as TicketDTO);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !mutation.isPending;

  return (
    <>
      <Sheet
        title="New Ticket"
        subtitle={`Will be #${nextNumber}`}
        onClose={onClose}
        headerAction={
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!canSubmit}
            aria-label="Create ticket"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent disabled:cursor-default disabled:opacity-50"
          >
            <Check className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        }
      >
        <GroupedList>
          <div className="flex h-[52px] items-center gap-3 px-4">
            <label htmlFor="nt-name" className="w-16 text-[17px]">
              Name
            </label>
            <input
              id="nt-name"
              type="text"
              autoFocus
              autoCapitalize="words"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none"
            />
          </div>
          <GroupedSeparator />
          <div className="flex h-[52px] items-center gap-3 px-4">
            <label htmlFor="nt-phone" className="w-16 text-[17px]">
              Phone
            </label>
            <input
              id="nt-phone"
              type="tel"
              placeholder="081234567890"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
            />
          </div>
        </GroupedList>

        <GroupedList>
          <div className="min-h-16 px-4 py-3.5">
            <label htmlFor="nt-notes" className="sr-only">
              Note for the illustrator
            </label>
            <input
              id="nt-notes"
              type="text"
              placeholder="Note (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
            />
          </div>
        </GroupedList>

        {error ? <p className="m-0 px-1 text-[15px] text-danger">{error}</p> : null}

        <CapsuleButton onClick={() => submit(false)} disabled={!canSubmit} pending={mutation.isPending}>
          Create Ticket &amp; Show QR
        </CapsuleButton>
      </Sheet>

      {duplicate ? (
        <ConfirmSheet
          title={`${duplicate.name} (#${duplicate.number}) already has a ticket with this number`}
          cancelLabel="Show Their QR"
          confirmLabel="Create Anyway"
          pending={mutation.isPending}
          onCancel={() => {
            const existing = duplicate;
            setDuplicate(null);
            onShowExisting(existing);
          }}
          onConfirm={() => {
            setDuplicate(null);
            void submit(true);
          }}
        />
      ) : null}
    </>
  );
}
