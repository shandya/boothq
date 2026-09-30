import type { DayDTO, StatsDTO } from "@boothq/shared";
import { Lock, LockOpen, MoreHorizontal } from "lucide-react";
import { formatClockTime } from "../../lib/format";
import { type TFunction, useT } from "../../lib/i18n";
import { GlassIconButton } from "../ui/GlassIconButton";

function statusDotAndLabel(day: DayDTO, t: TFunction): { dot: string; label: string } {
  if (day.paused) return { dot: "bg-status-orange-fg", label: t("ill.status.onBreak") };
  if (!day.acceptingTickets) return { dot: "bg-label-2", label: t("ill.status.notAccepting") };
  return { dot: "bg-switch-on", label: t("ill.status.open") };
}

type IllustratorHeaderProps = {
  day: DayDTO;
  stats: StatsDTO;
  wakeLockActive: boolean;
  onRequestWakeLock: () => void;
  onMenu: () => void;
};

// Compact status strip for one-handed use between drawings
// (docs/UI.md → Illustrator: /illustrator).
export function IllustratorHeader({
  day,
  stats,
  wakeLockActive,
  onRequestWakeLock,
  onMenu,
}: IllustratorHeaderProps) {
  const t = useT();
  const status = statusDotAndLabel(day, t);
  const avgMin = Math.round(stats.avgSessionSec / 60);
  const doneBy = stats.projectedFinishAt ? formatClockTime(stats.projectedFinishAt) : "—";

  return (
    <header className="flex items-start justify-between gap-2 px-1 pt-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[17px] font-semibold">
          <span
            className={`h-[9px] w-[9px] shrink-0 rounded-[3px] ${status.dot}`}
            aria-hidden="true"
          />
          {status.label}
          <span className="truncate font-normal text-label-2">
            {t("ill.header.stats", { served: stats.servedCount, avg: avgMin })}
          </span>
        </span>
        <span className="truncate text-[13px] text-label-2">
          {t("ill.header.waitingDone", { n: stats.waitingCount, time: doneBy })}
        </span>
        <button
          type="button"
          onClick={onRequestWakeLock}
          disabled={wakeLockActive}
          className="flex w-fit cursor-pointer items-center gap-1 bg-transparent text-[12px] text-label-2 disabled:cursor-default"
        >
          {wakeLockActive ? (
            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          ) : (
            <LockOpen className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          )}
          {wakeLockActive ? t("ill.header.screenOn") : t("ill.header.keepOn")}
        </button>
      </div>
      <GlassIconButton
        icon={<MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />}
        onClick={onMenu}
        aria-label={t("common.more")}
      />
    </header>
  );
}
