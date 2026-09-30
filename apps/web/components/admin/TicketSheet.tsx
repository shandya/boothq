"use client";

import type { TicketDTO } from "@boothq/shared";
import { Camera, Phone, QrCode, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  useNoShowTicket,
  usePickedUp,
  useRecallTicket,
  useRemoveTicket,
  useRequeueTicket,
  useRotateTicketToken,
  useStartTicket,
} from "../../lib/queries";
import { formatClockTime } from "../../lib/format";
import { type TFunction, useT } from "../../lib/i18n";
import { ticketPhotoUrl } from "../../lib/photo";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { PhotoThumb } from "../ui/PhotoViewer";
import { ReadyWhatsAppButton } from "./ReadyForPickupSection";
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

export function ordinal(n: number, t: TFunction): string {
  if (n === 1) return t("admin.ticket.ordinal1");
  if (n === 2) return t("admin.ticket.ordinal2");
  if (n === 3) return t("admin.ticket.ordinal3");
  return t("admin.ticket.ordinal", { n });
}

export function TicketSheet({
  ticket,
  positionLabel,
  onClose,
  onEdit,
  onShowQr,
  onToast,
}: TicketSheetProps) {
  const t = useT();
  const [notHere, setNotHere] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Cache-busts the photo URL when it's removed and a new one is added.
  const [photoVersion] = useState(() => Date.now());

  const start = useStartTicket();
  const recall = useRecallTicket();
  const noShow = useNoShowTicket();
  const requeue = useRequeueTicket();
  const remove = useRemoveTicket();
  const rotateToken = useRotateTicketToken();
  const pickedUp = usePickedUp();

  const canRemove =
    ticket.status === "WAITING" || ticket.status === "CALLED" || ticket.status === "NO_SHOW";

  return (
    <>
      <Sheet
        title={t("admin.ticket.title", { n: ticket.number })}
        onClose={onClose}
        headerAction={
          <button
            type="button"
            onClick={onEdit}
            className="h-11 cursor-pointer shape-sq bg-fill px-4 text-[17px] font-semibold text-link"
          >
            {t("admin.ticket.edit")}
          </button>
        }
      >
        <div className="flex items-center gap-3.5 px-1">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center shape-sq bg-fill text-[22px] font-bold tabular-nums">
            {ticket.number}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[22px] font-bold">{ticket.name}</span>
            <StatusChip status={ticket.status} className="self-start">
              {positionLabel ? t("admin.ticket.waitingPos", { pos: positionLabel }) : undefined}
            </StatusChip>
            {ticket.mode === "FROM_PHOTO" ? (
              <span className="flex items-center gap-1 text-[13px] text-label-2">
                <Camera className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />{" "}
                {t("admin.ticket.fromPhoto")}
              </span>
            ) : null}
          </div>
        </div>

        {ticket.hasPhoto ? (
          <GroupedList>
            <PhotoThumb
              src={ticketPhotoUrl(ticket.id, photoVersion)}
              alt={t("admin.ticket.photoAlt", { name: ticket.name })}
              className="max-h-56 w-full object-cover"
            />
          </GroupedList>
        ) : null}

        <GroupedList>
          <div className="flex items-center justify-between gap-3 py-1.5 pl-4 pr-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-label-2">{t("common.phone")}</span>
              <span className="text-[17px]">{ticket.phoneDisplay ?? "—"}</span>
            </div>
            {ticket.phone ? (
              <a
                href={`tel:${ticket.phone}`}
                aria-label={t("admin.ticket.callAria", { name: ticket.name })}
                className="flex h-11 w-11 items-center justify-center shape-sq bg-fill text-link"
              >
                <Phone className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
              </a>
            ) : null}
          </div>
          <GroupedSeparator />
          <div className="flex flex-col gap-0.5 px-4 py-2.5">
            <span className="text-[13px] text-label-2">{t("common.note")}</span>
            <span className="text-[17px]">{ticket.notes || "—"}</span>
          </div>
          <GroupedSeparator />
          <div className="flex flex-col gap-0.5 px-4 py-2.5">
            <span className="text-[13px] text-label-2">{t("admin.ticket.joined")}</span>
            <span className="text-[17px]">
              {ticket.etaSec != null
                ? t("admin.ticket.eta", {
                    time: formatClockTime(ticket.createdAt),
                    n: Math.round(ticket.etaSec / 60),
                  })
                : formatClockTime(ticket.createdAt)}
            </span>
          </div>
        </GroupedList>

        <GroupedList>
          {ticket.status === "READY" ? (
            <>
              <ActionRow
                label={t("admin.ready.pickedUp")}
                onClick={() =>
                  pickedUp.mutate(ticket.id, {
                    onSuccess: () => onToast(t("admin.ticket.markPicked")),
                  })
                }
                pending={pickedUp.isPending}
              />
              <GroupedSeparator inset={16} />
              <ReadyWhatsAppButton ticket={ticket} row />
              <GroupedSeparator inset={16} />
            </>
          ) : null}
          {ticket.status === "CALLED" ? (
            <>
              <ActionRow
                label={t("admin.ticket.startDrawing")}
                onClick={() => start.mutate(ticket.id)}
                pending={start.isPending}
              />
              <GroupedSeparator inset={16} />
              <ActionRow
                label={t("admin.ticket.recall")}
                onClick={() =>
                  recall.mutate(ticket.id, { onSuccess: () => onToast(t("admin.ticket.recalled")) })
                }
                pending={recall.isPending}
              />
              <GroupedSeparator inset={16} />
              <ActionRow label={t("admin.ticket.notHere")} onClick={() => setNotHere(true)} />
              <GroupedSeparator inset={16} />
            </>
          ) : null}
          {ticket.status === "NO_SHOW" ? (
            <>
              <ActionRow
                label={t("admin.ticket.requeue")}
                onClick={() =>
                  requeue.mutate(
                    { id: ticket.id },
                    { onSuccess: () => onToast(t("admin.ticket.backInQueue")) },
                  )
                }
                pending={requeue.isPending}
              />
              <GroupedSeparator inset={16} />
            </>
          ) : null}
          <ActionRow
            icon={<QrCode className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
            label={t("admin.ticket.showQr")}
            onClick={onShowQr}
          />
          <GroupedSeparator inset={48} />
          <ActionRow
            icon={<RefreshCw className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
            label={t("admin.ticket.newLink")}
            onClick={() =>
              rotateToken.mutate(ticket.id, {
                onSuccess: () => onToast(t("admin.ticket.linkRegenerated")),
              })
            }
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
              {t("admin.ticket.removeFromQueue")}
            </button>
          </GroupedList>
        ) : null}
      </Sheet>

      {notHere ? (
        <NotHereSheet
          onRequeue={(afterCount) => {
            setNotHere(false);
            requeue.mutate(
              { id: ticket.id, afterCount },
              { onSuccess: () => onToast(t("admin.ticket.backInQueue")) },
            );
          }}
          onNoShow={() => {
            setNotHere(false);
            noShow.mutate(ticket.id, { onSuccess: () => onToast(t("admin.ticket.markedNoShow")) });
          }}
          onCancel={() => setNotHere(false)}
        />
      ) : null}

      {confirmRemove ? (
        <ConfirmSheet
          title={t("admin.ticket.removeTitle", { n: ticket.number, name: ticket.name })}
          description={t("admin.ticket.cantUndo")}
          destructive
          confirmLabel={t("common.remove")}
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
