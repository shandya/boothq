"use client";

import type { DayDTO, TicketDTO } from "@boothq/shared";
import { useState, type ReactNode } from "react";
import { formatClockTime } from "../../lib/format";
import {
  useCallNext,
  useFinishTicket,
  useNoShowTicket,
  useRecallTicket,
  useRequeueTicket,
  useResumeDay,
  useStartTicket,
} from "../../lib/queries";
import { onStale, vibrate } from "../../lib/feedback";
import { getServerNow } from "../../lib/server-time";
import { CapsuleButton } from "../ui/CapsuleButton";
import { NotHereSheet } from "../ui/NotHereSheet";
import { TicketNumber } from "../ui/TicketNumber";
import { SessionTimer } from "./SessionTimer";

type IllustratorNowCardProps = {
  day: DayDTO;
  current: TicketDTO | null;
  nextWaiting: TicketDTO | null;
  avgSessionSec: number;
  onToast: (message: string) => void;
};

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((getServerNow().getTime() - new Date(iso).getTime()) / 60_000));
}

function calledAgoLabel(calledAt: string, callCount: number): string {
  const minutes = minutesSince(calledAt);
  const when = minutes < 1 ? "just now" : `${minutes} min ago`;
  return callCount > 1 ? `Called ${when} (×${callCount})` : `Called ${when}`;
}

function pauseLabel(day: DayDTO): string {
  return day.pauseUntil ? `On break until ${formatClockTime(day.pauseUntil)}` : "On break";
}

// Card wrapper: radius 28px (docs/UI.md → Components: Cards).
function Card({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-start gap-1.5 rounded-[28px] bg-card p-5">{children}</div>;
}

export function IllustratorNowCard({ day, current, nextWaiting, avgSessionSec, onToast }: IllustratorNowCardProps) {
  const [notHere, setNotHere] = useState(false);
  const callNext = useCallNext();
  const start = useStartTicket();
  const finish = useFinishTicket();
  const recall = useRecallTicket();
  const noShow = useNoShowTicket();
  const requeue = useRequeueTicket();
  const resumeDay = useResumeDay();

  if (day.paused) {
    return (
      <Card>
        <span className="text-[22px] font-semibold">{pauseLabel(day)}</span>
        {day.pausedAt ? (
          <span className="text-[15px] text-label-2">
            {minutesSince(day.pausedAt) < 1 ? "Just started" : `${minutesSince(day.pausedAt)} min so far`}
          </span>
        ) : null}
        {day.pauseReason ? <span className="text-[15px] text-label-2">{day.pauseReason}</span> : null}
        <CapsuleButton
          className="mt-2 w-full"
          pending={resumeDay.isPending}
          onClick={() =>
            resumeDay.mutate(undefined, {
              onSuccess: () => {
                vibrate();
                onToast("Break ended");
              },
              onError: onStale(onToast),
            })
          }
        >
          Resume
        </CapsuleButton>
      </Card>
    );
  }

  if (!current) {
    if (!nextWaiting) {
      return (
        <Card>
          <span className="text-[17px] text-label-2">No one waiting</span>
        </Card>
      );
    }
    return (
      <Card>
        <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">Next up</span>
        <span className="flex items-center gap-2 text-[22px] font-semibold">
          <TicketNumber number={nextWaiting.number} size="md" /> {nextWaiting.name}
        </span>
        <CapsuleButton
          className="mt-2 w-full"
          pending={callNext.isPending}
          onClick={() =>
            callNext.mutate(nextWaiting.id, {
              onSuccess: () => {
                vibrate();
                onToast(`Called #${nextWaiting.number}`);
              },
              onError: onStale(onToast),
            })
          }
        >
          Call #{nextWaiting.number} {nextWaiting.name}
        </CapsuleButton>
        <button
          type="button"
          onClick={() =>
            start.mutate(nextWaiting.id, {
              onSuccess: () => vibrate(),
              onError: onStale(onToast),
            })
          }
          disabled={start.isPending}
          className="w-full cursor-pointer bg-transparent text-center text-[15px] font-medium text-link disabled:cursor-default disabled:opacity-50"
        >
          Start directly
        </button>
      </Card>
    );
  }

  if (current.status === "CALLED") {
    return (
      <>
        <Card>
          <TicketNumber number={current.number} size="lg" />
          <span className="text-[22px] font-semibold">{current.name}</span>
          {current.notes ? <span className="text-[15px] text-label-2">&ldquo;{current.notes}&rdquo;</span> : null}
          {current.calledAt ? (
            <span className="text-[13px] text-label-2">{calledAgoLabel(current.calledAt, current.callCount)}</span>
          ) : null}
          <CapsuleButton
            className="mt-2 w-full"
            pending={start.isPending}
            onClick={() => start.mutate(current.id, { onSuccess: () => vibrate(), onError: onStale(onToast) })}
          >
            Start Drawing
          </CapsuleButton>
          <div className="flex w-full gap-2">
            <CapsuleButton
              className="flex-1"
              variant="secondary"
              size="md"
              pending={recall.isPending}
              onClick={() =>
                recall.mutate(current.id, {
                  onSuccess: () => {
                    vibrate();
                    onToast("Customer re-alerted");
                  },
                  onError: onStale(onToast),
                })
              }
            >
              Recall
            </CapsuleButton>
            <CapsuleButton className="flex-1" variant="secondary" size="md" onClick={() => setNotHere(true)}>
              Not Here
            </CapsuleButton>
          </div>
        </Card>
        {notHere ? (
          <NotHereSheet
            onRequeue={(afterCount) => {
              setNotHere(false);
              requeue.mutate(
                { id: current.id, afterCount },
                {
                  onSuccess: () => {
                    vibrate();
                    onToast("Back in the queue");
                  },
                  onError: onStale(onToast),
                },
              );
            }}
            onNoShow={() => {
              setNotHere(false);
              noShow.mutate(current.id, {
                onSuccess: () => {
                  vibrate();
                  onToast("Marked no-show");
                },
                onError: onStale(onToast),
              });
            }}
            onCancel={() => setNotHere(false)}
          />
        ) : null}
      </>
    );
  }

  // SERVING
  return (
    <Card>
      <span className="text-[15px] text-label-2">Drawing for</span>
      <span className="text-[22px] font-semibold">{current.name}</span>
      <SessionTimer
        since={current.startedAt ?? current.createdAt}
        avgSessionSec={avgSessionSec}
        className="text-[72px] leading-none"
      />
      <span className="text-[13px] text-label-2">Usually takes {Math.round(avgSessionSec / 60)} min</span>
      <CapsuleButton
        className="mt-2 w-full"
        pending={finish.isPending}
        onClick={() =>
          finish.mutate(
            { id: current.id, callNext: true },
            {
              onSuccess: () => {
                vibrate();
                onToast("Finished");
              },
              onError: onStale(onToast),
            },
          )
        }
      >
        Finish &amp; Call Next
      </CapsuleButton>
      <CapsuleButton
        className="w-full"
        variant="secondary"
        pending={finish.isPending}
        onClick={() =>
          finish.mutate(
            { id: current.id, callNext: false },
            {
              onSuccess: () => {
                vibrate();
                onToast("Finished");
              },
              onError: onStale(onToast),
            },
          )
        }
      >
        Finish
      </CapsuleButton>
    </Card>
  );
}
