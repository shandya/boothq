import type { TicketDTO } from "@boothq/shared";
import clsx from "clsx";
import { Camera } from "lucide-react";
import { useT } from "../../lib/i18n";
import { ElapsedTimer } from "../ui/ElapsedTimer";
import { GroupedList, GroupedRow } from "../ui/GroupedList";
import { formatClockTime } from "../../lib/format";

type NowCardProps = {
  ticket: TicketDTO | null;
  onOpen: (ticketId: string) => void;
};

export function NowCard({ ticket, onOpen }: NowCardProps) {
  const t = useT();
  const serving = ticket?.status === "SERVING";

  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="m-0 mt-1.5 px-4 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">{t("admin.now")}</h2>
      <GroupedList>
        {ticket ? (
          <GroupedRow minHeight={64} onClick={() => onOpen(ticket.id)}>
            <span
              className={clsx(
                "flex h-11 w-11 shrink-0 items-center justify-center shape-sq text-[17px] font-bold tabular-nums",
                serving ? "bg-status-blue-bg text-status-blue-fg" : "bg-status-orange-bg text-status-orange-fg",
              )}
            >
              {ticket.number}
            </span>
            <span className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="flex items-center gap-1.5 truncate text-[17px] font-semibold">
                {ticket.name}
                {ticket.mode === "FROM_PHOTO" ? (
                  <Camera className="h-[13px] w-[13px] shrink-0 text-label-2" strokeWidth={2} aria-label={t("admin.fromPhoto")} />
                ) : null}
              </span>
              <span className="truncate text-[13px] text-label-2">
                {serving && ticket.startedAt
                  ? t("admin.now.started", { time: formatClockTime(ticket.startedAt) })
                  : ticket.calledAt
                    ? ticket.callCount > 1
                      ? t("admin.now.calledTimes", { time: formatClockTime(ticket.calledAt), n: ticket.callCount })
                      : t("admin.now.called", { time: formatClockTime(ticket.calledAt) })
                    : null}
              </span>
            </span>
            <span
              className={clsx(
                "shrink-0 shape-sq px-2.5 py-[5px] text-[13px] font-semibold tabular-nums",
                serving ? "bg-status-blue-bg text-status-blue-fg" : "bg-status-orange-bg text-status-orange-fg",
              )}
            >
              {serving && ticket.startedAt ? (
                <>
                  {t("admin.now.drawing")} <ElapsedTimer since={ticket.startedAt} />
                </>
              ) : (
                t("admin.now.calledChip")
              )}
            </span>
          </GroupedRow>
        ) : (
          <div className="flex min-h-[64px] items-center px-4 text-[15px] text-label-2">{t("admin.now.none")}</div>
        )}
      </GroupedList>
    </div>
  );
}
