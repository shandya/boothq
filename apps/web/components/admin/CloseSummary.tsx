import type { StatsDTO } from "@boothq/shared";
import { useT } from "../../lib/i18n";
import { useFormat } from "../../lib/i18n/format";
import { CapsuleButton } from "../ui/CapsuleButton";

export function CloseSummary({ summary, onDone }: { summary: StatsDTO; onDone: () => void }) {
  const t = useT();
  const format = useFormat();
  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-6 bg-bg px-4 pb-8 pt-6 text-label">
      <div className="flex flex-col items-center gap-1 pt-6">
        <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">{t("admin.summary.closed")}</span>
        <h1 className="m-0 text-[28px] font-bold">{t("admin.summary.title")}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryTile label={t("admin.summary.served")} value={String(summary.servedCount)} />
        <SummaryTile label={t("admin.summary.noShows")} value={String(summary.noShowCount)} />
        <SummaryTile label={t("admin.summary.cancelled")} value={String(summary.cancelledCount)} />
        <SummaryTile label={t("admin.summary.avg")} value={format.duration(summary.avgSessionSec)} />
      </div>
      <div className="flex flex-col gap-1 shape-tile sticker bg-card px-4 py-3.5">
        <span className="text-[12px] font-semibold text-label-2">{t("admin.summary.longest")}</span>
        <span className="text-[22px] font-bold tabular-nums">
          {summary.longestWaitSec != null ? format.duration(summary.longestWaitSec) : "—"}
        </span>
      </div>

      {summary.readyForPickupCount > 0 ? (
        <div className="flex flex-col gap-1 shape-tile sticker bg-status-green-bg px-4 py-3.5 text-status-green-fg">
          <span className="text-[17px] font-semibold">
            {t(summary.readyForPickupCount === 1 ? "admin.summary.pickup" : "admin.summary.pickupMany", { n: summary.readyForPickupCount })}
          </span>
          <span className="text-[13px]">{t("admin.summary.pickupHint")}</span>
        </div>
      ) : null}

      <div className="flex-grow" />
      <CapsuleButton onClick={onDone}>{t("common.done")}</CapsuleButton>
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
