"use client";

import type { DayHistoryItemDTO } from "@boothq/shared";
import { ChevronLeft, Download } from "lucide-react";
import Link from "next/link";
import { formatClockTime, formatShortDate } from "../../lib/format";
import { type TFunction, useI18n, useT } from "../../lib/i18n";
import { formatDurationT } from "../../lib/i18n/format";
import { useDayHistory } from "../../lib/queries";
import { useStaffTitle } from "../../lib/useStaffTitle";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";
import { LargeTitle } from "../ui/LargeTitle";
import { OfflineBanner } from "../ui/OfflineBanner";

type EventGroup = { id: string; name: string; days: DayHistoryItemDTO[] };

// The list is newest first and Events never overlap in time, so a group's days
// are contiguous.
function groupByEvent(days: DayHistoryItemDTO[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const day of days) {
    const group = groups.find((g) => g.id === day.event.id);
    if (group) group.days.push(day);
    else groups.push({ id: day.event.id, name: day.event.name, days: [day] });
  }
  return groups;
}

function daysLabel(count: number, t: TFunction): string {
  return t(count === 1 ? "admin.events.day" : "admin.events.days", { n: count });
}

function DayRow({ day }: { day: DayHistoryItemDTO }) {
  const { t, lang } = useI18n();
  const { summary } = day;
  const when = day.closedAt
    ? `${formatClockTime(day.openedAt)} – ${formatClockTime(day.closedAt)}`
    : t("admin.history.openNow", { time: formatClockTime(day.openedAt) });
  const pace = [
    summary.avgSessionSec > 0
      ? t("admin.history.avg", { dur: formatDurationT(t, summary.avgSessionSec) })
      : null,
    summary.longestWaitSec != null
      ? t("admin.history.longest", { dur: formatDurationT(t, summary.longestWaitSec) })
      : null,
  ].filter(Boolean);
  const date = formatShortDate(day.openedAt, lang);
  const label = t("admin.history.dayLabel", { n: day.dayNumber, date });

  return (
    <div className="flex items-center gap-3 py-3 pl-4 pr-3">
      <div className="flex min-w-0 flex-grow flex-col gap-0.5">
        <span className="text-[17px] font-semibold">
          {t("admin.history.dayTitle", { n: day.dayNumber, date })}
        </span>
        <span className="text-[13px] text-label-2">{when}</span>
        <span className="text-[15px]">
          {t("admin.history.counts", {
            served: summary.servedCount,
            noShow: summary.noShowCount,
            cancelled: summary.cancelledCount,
          })}
        </span>
        {pace.length > 0 ? (
          <span className="text-[13px] text-label-2">{pace.join(" · ")}</span>
        ) : null}
      </div>
      <a
        href={`/api/days/${encodeURIComponent(day.id)}/export.csv`}
        download
        aria-label={t("admin.history.export", { label })}
        className="glass flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center shape-sq text-link"
      >
        <Download className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </a>
    </div>
  );
}

export function HistoryScreen() {
  useStaffTitle();
  const t = useT();
  const query = useDayHistory();
  const days = query.data?.days;
  const groups = days ? groupByEvent(days) : [];

  return (
    <div className="min-h-dvh bg-bg pb-10 text-label">
      <OfflineBanner lastUpdated={query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null} />

      <div className="flex flex-col gap-4 px-4 pt-3">
        <header className="flex h-11 items-center px-1">
          <Link
            href="/admin"
            aria-label={t("admin.history.back")}
            className="glass flex h-11 w-11 shrink-0 items-center justify-center shape-sq text-label"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
          </Link>
        </header>

        <div className="flex flex-col px-1">
          <LargeTitle>{t("admin.history.title")}</LargeTitle>
          <span className="text-[15px] text-label-2">{t("admin.history.hint")}</span>
        </div>

        {query.isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-[17px] font-semibold">{t("admin.history.loadFailed")}</span>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="h-11 cursor-pointer bg-transparent px-4 text-[17px] text-link"
            >
              {t("common.tryAgain")}
            </button>
          </div>
        ) : !days ? (
          <div className="flex justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-fill border-t-label-2"
              role="status"
              aria-label={t("common.loading")}
            />
          </div>
        ) : days.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-[28px] bg-card px-6 py-10 text-center">
            <span className="text-[17px] font-semibold">{t("admin.history.empty")}</span>
            <span className="text-[15px] text-label-2">{t("admin.history.emptyHint")}</span>
          </div>
        ) : (
          groups.map((group) => {
            const served = group.days.reduce((sum, d) => sum + d.summary.servedCount, 0);
            return (
              <section key={group.id} className="flex flex-col gap-2" aria-label={group.name}>
                <div className="flex items-baseline justify-between gap-3 px-4">
                  <h2 className="m-0 min-w-0 truncate text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
                    {group.name}
                  </h2>
                  <span className="shrink-0 text-[13px] text-label-2">
                    {t("admin.history.groupCount", {
                      days: daysLabel(group.days.length, t),
                      served,
                    })}
                  </span>
                </div>
                <GroupedList>
                  {group.days.map((day, index) => (
                    <div key={day.id}>
                      {index > 0 ? <GroupedSeparator /> : null}
                      <DayRow day={day} />
                    </div>
                  ))}
                </GroupedList>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
