"use client";

import { useState } from "react";
import { ApiError, type EventWithSummary } from "../../lib/api";
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

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

function dateRange(event: EventWithSummary): string {
  const start = formatShortDate(event.startedAt);
  if (!event.endedAt) return `Since ${start}`;
  const end = formatShortDate(event.endedAt);
  return start === end ? start : `${start} – ${end}`;
}

function facts(event: EventWithSummary): string {
  return `${dateRange(event)} · ${plural(event.summary.dayCount, "day")} · ${event.summary.servedCount} served`;
}

export function EventsSheet({ dayOpen, onClose, onStart, onRename, onToast }: EventsSheetProps) {
  const query = useEvents();
  const endEvent = useEndEvent();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const events = query.data?.events ?? [];
  const active = events.find((e) => e.status === "ACTIVE") ?? null;
  const past = events.filter((e) => e.status === "ENDED");

  return (
    <>
      <Sheet title="Events" onClose={onClose}>
        {query.isError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="text-[15px] text-label-2">Couldn&apos;t load events.</span>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="h-11 cursor-pointer bg-transparent px-4 text-[17px] text-link"
            >
              Try Again
            </button>
          </div>
        ) : !query.data ? (
          <div className="flex justify-center py-8">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-fill border-t-label-2"
              role="status"
              aria-label="Loading"
            />
          </div>
        ) : (
          <>
            {active ? (
              <GroupedList>
                <div className="flex flex-col gap-0.5 px-4 py-3.5">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">Current</span>
                  <span className="text-[17px] font-semibold">{active.name}</span>
                  <span className="text-[13px] text-label-2">{facts(active)}</span>
                </div>
                <GroupedSeparator />
                <GroupedRow minHeight={52} onClick={onRename}>
                  <span className="text-link">Rename</span>
                </GroupedRow>
                <GroupedSeparator />
                <GroupedRow minHeight={52} onClick={() => setConfirmEnd(true)} disabled={dayOpen}>
                  <span className="text-danger">End Event</span>
                </GroupedRow>
              </GroupedList>
            ) : (
              <GroupedList>
                <div className="flex min-h-16 items-center px-4 text-[15px] text-label-2">No event running</div>
              </GroupedList>
            )}

            {past.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="px-4 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
                  Past events
                </span>
                <GroupedList>
                  {past.map((event, index) => (
                    <div key={event.id}>
                      {index > 0 ? <GroupedSeparator /> : null}
                      <div className="flex flex-col gap-0.5 px-4 py-3">
                        <span className="text-[17px]">{event.name}</span>
                        <span className="text-[13px] text-label-2">{facts(event)}</span>
                      </div>
                    </div>
                  ))}
                </GroupedList>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <CapsuleButton variant="secondary" onClick={onStart} disabled={dayOpen}>
                Start New Event
              </CapsuleButton>
              {dayOpen ? <p className="m-0 text-center text-[13px] text-label-2">Close the booth first.</p> : null}
            </div>
          </>
        )}
      </Sheet>

      {confirmEnd && active ? (
        <ConfirmSheet
          title={`End ${active.name}?`}
          description="You can start another event any time."
          confirmLabel="End Event"
          destructive
          pending={endEvent.isPending}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() =>
            endEvent.mutate(undefined, {
              onSuccess: (result) => {
                setConfirmEnd(false);
                onToast(`Event ended · ${result.summary.servedCount} served`);
              },
              onError: (err) => {
                setConfirmEnd(false);
                onToast(err instanceof ApiError ? err.message : "Couldn't end the event.");
              },
            })
          }
        />
      ) : null}
    </>
  );
}
