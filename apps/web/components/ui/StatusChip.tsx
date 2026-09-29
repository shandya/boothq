import type { TicketStatus } from "@boothq/shared";
import type { ReactNode } from "react";
import clsx from "clsx";

const STATUS_CLASSES: Record<TicketStatus, string> = {
  WAITING: "bg-status-gray-bg text-status-gray-fg",
  NO_SHOW: "bg-status-gray-bg text-status-gray-fg",
  CANCELLED: "bg-status-gray-bg text-status-gray-fg",
  CALLED: "bg-status-orange-bg text-status-orange-fg",
  SERVING: "bg-status-blue-bg text-status-blue-fg",
  DONE: "bg-status-green-bg text-status-green-fg",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  WAITING: "Waiting",
  CALLED: "Called",
  SERVING: "Drawing",
  DONE: "Done",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};

type StatusChipProps = {
  status: TicketStatus;
  children?: ReactNode;
  className?: string;
};

export function StatusChip({ status, children, className }: StatusChipProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 shape-sq px-2.5 py-1 text-[13px] font-semibold tabular-nums",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {children ?? STATUS_LABELS[status]}
    </span>
  );
}
