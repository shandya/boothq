import type { DayDTO } from "@boothq/shared";
import { MoreHorizontal } from "lucide-react";
import { GlassIconButton } from "../ui/GlassIconButton";
import { LargeTitle } from "../ui/LargeTitle";

function statusChip(day: DayDTO): { label: string; bg: string; fg: string; dot?: string } {
  if (day.paused) {
    return { label: "On Break", bg: "bg-status-orange-bg", fg: "text-status-orange-fg" };
  }
  if (!day.acceptingTickets) {
    return { label: "Open · Not Accepting", bg: "bg-status-gray-bg", fg: "text-status-gray-fg" };
  }
  return { label: "Open · Taking Tickets", bg: "bg-status-green-bg", fg: "text-status-green-fg", dot: "bg-switch-on" };
}

type AdminHeaderProps = {
  day: DayDTO;
  waitingCount: number;
  avgSessionLabel: string;
  projectedFinishLabel: string;
  onMenu: () => void;
};

export function AdminHeader({ day, waitingCount, avgSessionLabel, projectedFinishLabel, onMenu }: AdminHeaderProps) {
  const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";
  const chip = statusChip(day);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex h-11 items-center justify-between px-1">
        <span className={`flex items-center gap-1.5 shape-sq px-[11px] py-1.5 text-[13px] font-semibold ${chip.bg} ${chip.fg}`}>
          {chip.dot ? <span className={`h-[7px] w-[7px] rounded-[3px] ${chip.dot}`} /> : null}
          {chip.label}
        </span>
        <GlassIconButton icon={<MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />} onClick={onMenu} aria-label="More" />
      </header>

      <div className="flex flex-col px-1">
        <LargeTitle>Queue</LargeTitle>
        <span className="text-[15px] text-label-2">{boothName}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 shape-tile sticker bg-card px-3.5 py-2.5">
          <span className="truncate text-[12px] font-semibold text-label-2">Waiting</span>
          <span className="truncate text-[22px] font-bold tabular-nums">{waitingCount}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 shape-tile sticker bg-card px-3.5 py-2.5">
          <span className="truncate text-[12px] font-semibold text-label-2">Avg drawing</span>
          <span className="truncate text-[22px] font-bold tabular-nums">{avgSessionLabel}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 shape-tile sticker bg-card px-3.5 py-2.5">
          <span className="truncate text-[12px] font-semibold text-label-2">Line done by</span>
          <span className="truncate text-[22px] font-bold tabular-nums">{projectedFinishLabel}</span>
        </div>
      </div>
    </div>
  );
}
