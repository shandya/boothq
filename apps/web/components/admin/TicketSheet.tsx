"use client";

import type { TicketDTO } from "@boothq/shared";
import { Phone, QrCode, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  useNoShowTicket,
  useRecallTicket,
  useRemoveTicket,
  useRequeueTicket,
  useRotateTicketToken,
  useStartTicket,
} from "../../lib/queries";
import { formatClockTime } from "../../lib/format";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { Sheet } from "../ui/Sheet";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";
import { NotHereSheet } from "../ui/NotHereSheet";
import { StatusChip } from "../ui/StatusChip";

type TicketSheetProps = {
  ticket: TicketDTO;
  positionLabel: string | null; // e.g. "3rd in line", null when not WAITING
  onClose: () => void;
  onEdit: () => void;
  onShowQr: () => void;
  onToast: (message: string) => void;
};

const ORDINALS = ["1st", "2nd", "3rd"];

export function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

export function TicketSheet({ ticket, positionLabel, onClose, onEdit, onShowQr, onToast }: TicketSheetProps) {
  const [notHere, setNotHere] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const start = useStartTicket();
  const recall = useRecallTicket();
  const noShow = useNoShowTicket();
  const requeue = useRequeueTicket();
  const remove = useRemoveTicket();
  const rotateToken = useRotateTicketToken();

  const canRemove = ticket.status === "WAITING" || ticket.status === "CALLED" || ticket.status === "NO_SHOW";

  return (
    <>
      <Sheet
        title={`Ticket #${ticket.number}`}
        onClose={onClose}
        headerAction={
          <button
            type="button"
            onClick={onEdit}
            className="h-11 cursor-pointer rounded-full bg-fill px-4 text-[17px] font-semibold text-link"
          >
            Edit
          </button>
        }
      >
          <div className="flex items-center gap-3.5 px-1">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-fill text-[22px] font-bold tabular-nums">
              {ticket.number}
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">{ticket.name}</span>
              <StatusChip status={ticket.status} className="self-start">
                {positionLabel ? `Waiting · ${positionLabel} in line` : undefined}
              </StatusChip>
            </div>
          </div>

          <GroupedList>
            <div className="flex items-center justify-between gap-3 py-1.5 pl-4 pr-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-label-2">Phone</span>
                <span className="text-[17px]">{ticket.phoneDisplay ?? "—"}</span>
              </div>
              {ticket.phone ? (
                <a
                  href={`tel:${ticket.phone}`}
                  aria-label={`Call ${ticket.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-fill text-link"
                >
                  <Phone className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                </a>
              ) : null}
            </div>
            <GroupedSeparator />
            <div className="flex flex-col gap-0.5 px-4 py-2.5">
              <span className="text-[13px] text-label-2">Note</span>
              <span className="text-[17px]">{ticket.notes || "—"}</span>
            </div>
            <GroupedSeparator />
            <div className="flex flex-col gap-0.5 px-4 py-2.5">
              <span className="text-[13px] text-label-2">Joined</span>
              <span className="text-[17px]">
                {formatClockTime(ticket.createdAt)}
                {ticket.etaSec != null ? ` · ETA ~${Math.round(ticket.etaSec / 60)} min` : null}
              </span>
            </div>
          </GroupedList>

          <GroupedList>
            {ticket.status === "CALLED" ? (
              <>
                <ActionRow label="Start Drawing" onClick={() => start.mutate(ticket.id)} pending={start.isPending} />
                <GroupedSeparator inset={16} />
                <ActionRow
                  label="Recall"
                  onClick={() => recall.mutate(ticket.id, { onSuccess: () => onToast("Customer re-alerted") })}
                  pending={recall.isPending}
                />
                <GroupedSeparator inset={16} />
                <ActionRow label="Not Here" onClick={() => setNotHere(true)} />
                <GroupedSeparator inset={16} />
              </>
            ) : null}
            {ticket.status === "NO_SHOW" ? (
              <>
                <ActionRow
                  label="Requeue"
                  onClick={() => requeue.mutate({ id: ticket.id }, { onSuccess: () => onToast("Back in the queue") })}
                  pending={requeue.isPending}
                />
                <GroupedSeparator inset={16} />
              </>
            ) : null}
            <ActionRow icon={<QrCode className="h-5 w-5" strokeWidth={2} aria-hidden="true" />} label="Show QR Code" onClick={onShowQr} />
            <GroupedSeparator inset={48} />
            <ActionRow
              icon={<RefreshCw className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
              label="Make New Link"
              onClick={() => rotateToken.mutate(ticket.id, { onSuccess: () => onToast("Link regenerated") })}
              pending={rotateToken.isPending}
            />
          </GroupedList>

          {canRemove ? (
            <GroupedList>
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="h-[50px] w-full cursor-pointer bg-transparent text-[17px] font-medium text-danger"
              >
                Remove from Queue
              </button>
            </GroupedList>
          ) : null}
      </Sheet>

      {notHere ? (
        <NotHereSheet
          onRequeue={(afterCount) => {
            setNotHere(false);
            requeue.mutate({ id: ticket.id, afterCount }, { onSuccess: () => onToast("Back in the queue") });
          }}
          onNoShow={() => {
            setNotHere(false);
            noShow.mutate(ticket.id, { onSuccess: () => onToast("Marked no-show") });
          }}
          onCancel={() => setNotHere(false)}
        />
      ) : null}

      {confirmRemove ? (
        <ConfirmSheet
          title={`Remove #${ticket.number} ${ticket.name}?`}
          description="This can't be undone."
          destructive
          confirmLabel="Remove"
          pending={remove.isPending}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            remove.mutate(ticket.id, {
              onSuccess: () => {
                setConfirmRemove(false);
                onClose();
              },
            });
          }}
        />
      ) : null}
    </>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  pending,
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex h-[50px] w-full cursor-pointer items-center gap-3 bg-transparent px-4 text-left text-[17px] text-link disabled:cursor-default disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
