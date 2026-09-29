import type { StatsDTO } from "@boothq/shared";
import { formatDuration } from "@boothq/shared/format";
import { CapsuleButton } from "../ui/CapsuleButton";

export function CloseSummary({ summary, onDone }: { summary: StatsDTO; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-6 bg-bg px-4 pb-8 pt-6 text-label">
      <div className="flex flex-col items-center gap-1 pt-6">
        <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">Booth Closed</span>
        <h1 className="m-0 text-[28px] font-bold">Day Summary</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryTile label="Served" value={String(summary.servedCount)} />
        <SummaryTile label="No-shows" value={String(summary.noShowCount)} />
        <SummaryTile label="Cancelled" value={String(summary.cancelledCount)} />
        <SummaryTile label="Avg drawing" value={formatDuration(summary.avgSessionSec)} />
      </div>
      <div className="flex flex-col gap-1 shape-tile sticker bg-card px-4 py-3.5">
        <span className="text-[12px] font-semibold text-label-2">Longest wait</span>
        <span className="text-[22px] font-bold tabular-nums">
          {summary.longestWaitSec != null ? formatDuration(summary.longestWaitSec) : "—"}
        </span>
      </div>

      <div className="flex-grow" />
      <CapsuleButton onClick={onDone}>Done</CapsuleButton>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 shape-tile sticker bg-card px-4 py-3.5">
      <span className="text-[12px] font-semibold text-label-2">{label}</span>
      <span className="text-[22px] font-bold tabular-nums">{value}</span>
    </div>
  );
}
