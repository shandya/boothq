"use client";

import { useState } from "react";
import { type EventWithSummary } from "../../lib/api";
import { type TFunction, useI18n } from "../../lib/i18n";
import { errorText } from "../../lib/i18n/errors";
import { formatShortDate } from "../../lib/format";
import { useEndEvent, useEvents } from "../../lib/queries";
import { CapsuleButton } from "../ui/CapsuleButton";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";

type EventsSheetProps = {
  dayOpen: boolean;
  onClose: () => void;
  onStart: () => void;
  onRename: () => void;
  onToast: (message: string) => void;
};

function dateRange(event: EventWithSummary, t: TFunction, locale: string): string {
  const start = formatShortDate(event.startedAt, locale);
  if (!event.endedAt) return t("admin.events.since", { date: start });
  const end = formatShortDate(event.endedAt, locale);
  return start === end ? start : `${start} – ${end}`;
}

function facts(event: EventWithSummary, t: TFunction, locale: string): string {
  const { dayCount, servedCount } = event.summary;
  return t("admin.events.facts", {
    range: dateRange(event, t, locale),
    days: t(dayCount === 1 ? "admin.events.day" : "admin.events.days", { n: dayCount }),
    served: servedCount,
  });
}

export function EventsSheet({ dayOpen, onClose, onStart, onRename, onToast }: EventsSheetProps) {
  const { t, lang } = useI18n();
  const query = useEvents();
  const endEvent = useEndEvent();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const events = query.data?.events ?? [];
  const active = events.find((e) => e.status === "ACTIVE") ?? null;
  const past = events.filter((e) => e.status === "ENDED");

  return (
    <>
      <Sheet title={t("admin.events.title")} onClose={onClose}>
        {query.isError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="text-[15px] text-label-2">{t("admin.events.loadFailed")}</span>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="h-11 cursor-pointer bg-transparent px-4 text-[17px] text-link"
            >
              {t("common.tryAgain")}
            </button>
          </div>
        ) : !query.data ? (
          <div className="flex justify-center py-8">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-fill border-t-label-2"
              role="status"
              aria-label={t("common.loading")}
            />
          </div>
        ) : (
          <>
            {active ? (
              <GroupedList>
                <div className="flex flex-col gap-0.5 px-4 py-3.5">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
                    {t("admin.events.current")}
                  </span>
                  <span className="text-[17px] font-semibold">{active.name}</span>
                  <span className="text-[13px] text-label-2">{facts(active, t, lang)}</span>
                </div>
                <GroupedSeparator />
                <GroupedRow minHeight={52} onClick={onRename}>
                  <span className="text-link">{t("admin.events.rename")}</span>
                </GroupedRow>
                <GroupedSeparator />
                <GroupedRow minHeight={52} onClick={() => setConfirmEnd(true)} disabled={dayOpen}>
                  <span className="text-danger">{t("admin.events.end")}</span>
                </GroupedRow>
              </GroupedList>
            ) : (
              <GroupedList>
                <div className="flex min-h-16 items-center px-4 text-[15px] text-label-2">
                  {t("admin.events.none")}
                </div>
              </GroupedList>
            )}

            {past.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="px-4 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
                  {t("admin.events.past")}
                </span>
                <GroupedList>
                  {past.map((event, index) => (
                    <div key={event.id}>
                      {index > 0 ? <GroupedSeparator /> : null}
                      <div className="flex flex-col gap-0.5 px-4 py-3">
                        <span className="text-[17px]">{event.name}</span>
                        <span className="text-[13px] text-label-2">{facts(event, t, lang)}</span>
                      </div>
                    </div>
                  ))}
                </GroupedList>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <CapsuleButton variant="secondary" onClick={onStart} disabled={dayOpen}>
                {t("admin.events.startNew")}
              </CapsuleButton>
              {dayOpen ? (
                <p className="m-0 text-center text-[13px] text-label-2">
                  {t("admin.events.closeFirst")}
                </p>
              ) : null}
            </div>
          </>
        )}
      </Sheet>

      {confirmEnd && active ? (
        <ConfirmSheet
          title={t("admin.events.endTitle", { name: active.name })}
          description={t("admin.events.endDesc")}
          confirmLabel={t("admin.events.end")}
          destructive
          pending={endEvent.isPending}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() =>
            endEvent.mutate(undefined, {
              onSuccess: (result) => {
                setConfirmEnd(false);
                onToast(t("admin.events.ended", { n: result.summary.servedCount }));
              },
              onError: (err) => {
                setConfirmEnd(false);
                onToast(errorText(err, t, "admin.events.endFailed"));
              },
            })
          }
        />
      ) : null}
    </>
  );
}
