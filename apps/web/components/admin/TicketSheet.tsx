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
import { GlassIconButton } from "../ui/GlassIconButton";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";
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
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
        <section className="fixed inset-x-2 bottom-2 flex max-h-[calc(100%-16px)] flex-col gap-4 overflow-y-auto rounded-[38px] bg-sheet px-4 pb-[22px] pt-3.5 shadow-[0_-4px_40px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between">
            <GlassIconButton icon={<CloseIcon />} onClick={onClose} aria-label="Close" />
            <h2 className="m-0 text-[17px] font-semibold">Ticket #{ticket.number}</h2>
            <button
              type="button"
              onClick={onEdit}
              className="glass h-11 cursor-pointer rounded-full px-4 text-[17px] font-semibold text-link"
            >
              Edit
            </button>
          </div>

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
        </section>
      </div>

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

function NotHereSheet({
  onRequeue,
  onNoShow,
  onCancel,
}: {
  onRequeue: (afterCount: number) => void;
  onNoShow: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-dim" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-x-8 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-[20px] bg-sheet shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="px-5 py-4 text-center text-[13px] text-label-2">Not here right now?</div>
        <GroupedSeparator inset={0} />
        <button type="button" onClick={() => onRequeue(2)} className="h-11 cursor-pointer bg-transparent text-[17px] text-link">
          Put Back 2 Places
        </button>
        <GroupedSeparator inset={0} />
        <button type="button" onClick={onNoShow} className="h-11 cursor-pointer bg-transparent text-[17px] text-danger">
          Mark No-Show
        </button>
        <GroupedSeparator inset={0} />
        <button type="button" onClick={onCancel} className="h-11 cursor-pointer bg-transparent text-[17px] font-semibold text-link">
          Cancel
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
