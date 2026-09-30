"use client";

import type { DayDTO, TicketDTO } from "@boothq/shared";
import { Camera } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatClockTime } from "../../lib/format";
import { type TFunction, useT } from "../../lib/i18n";
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
import { ticketPhotoUrl } from "../../lib/photo";
import { getServerNow } from "../../lib/server-time";
import { CapsuleButton } from "../ui/CapsuleButton";
import { NotHereSheet } from "../ui/NotHereSheet";
import { PhotoThumb } from "../ui/PhotoViewer";
import { TicketNumber } from "../ui/TicketNumber";
import { ElapsedTimer } from "../ui/ElapsedTimer";
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

function calledAgoLabel(calledAt: string, callCount: number, t: TFunction): string {
  const minutes = minutesSince(calledAt);
  if (minutes < 1)
    return callCount > 1
      ? t("ill.now.calledJustNowTimes", { c: callCount })
      : t("ill.now.calledJustNow");
  return callCount > 1
    ? t("ill.now.calledAgoTimes", { n: minutes, c: callCount })
    : t("ill.now.calledAgo", { n: minutes });
}

const fromPhoto = (ticket: TicketDTO): boolean => ticket.mode === "FROM_PHOTO";

function pauseLabel(day: DayDTO, t: TFunction): string {
  return day.pauseUntil
    ? t("ill.now.onBreakUntil", { time: formatClockTime(day.pauseUntil) })
    : t("ill.now.onBreak");
}

// Card wrapper: radius 28px (docs/UI.md → Components: Cards).
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5 shape-card sticker bg-card p-5">
      {children}
    </div>
  );
}

export function IllustratorNowCard({
  day,
  current,
  nextWaiting,
  avgSessionSec,
  onToast,
}: IllustratorNowCardProps) {
  const t = useT();
  const [notHere, setNotHere] = useState(false);
  const callNext = useCallNext();
  const start = useStartTicket();
  const finish = useFinishTicket();
  const recall = useRecallTicket();
  const noShow = useNoShowTicket();
  const requeue = useRequeueTicket();
  const resumeDay = useResumeDay();
  const [photoVersion] = useState(() => Date.now());

  if (day.paused) {
    return (
      <Card>
        <span className="text-[22px] font-semibold">{pauseLabel(day, t)}</span>
        {day.pausedAt ? (
          <span className="text-[15px] text-label-2">
            {minutesSince(day.pausedAt) < 1
              ? t("ill.now.justStarted")
              : t("ill.now.minSoFar", { n: minutesSince(day.pausedAt) })}
          </span>
        ) : null}
        {day.pauseReason ? (
          <span className="text-[15px] text-label-2">{day.pauseReason}</span>
        ) : null}
        <CapsuleButton
          className="mt-2 w-full"
          pending={resumeDay.isPending}
          onClick={() =>
            resumeDay.mutate(undefined, {
              onSuccess: () => {
                vibrate();
                onToast(t("ill.now.breakEnded"));
              },
              onError: onStale(onToast, t),
            })
          }
        >
          {t("ill.now.resume")}
        </CapsuleButton>
      </Card>
    );
  }

  if (!current) {
    if (!nextWaiting) {
      return (
        <Card>
          <span className="text-[17px] text-label-2">{t("ill.now.noOne")}</span>
        </Card>
      );
    }
    return (
      <Card>
        <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          {t("ill.now.nextUp")}
        </span>
        <span className="flex items-center gap-2 text-[22px] font-semibold">
          <TicketNumber number={nextWaiting.number} size="md" /> {nextWaiting.name}
          {fromPhoto(nextWaiting) ? (
            <Camera
              className="h-[18px] w-[18px] shrink-0 text-label-2"
              strokeWidth={2}
              aria-label={t("admin.fromPhoto")}
            />
          ) : null}
        </span>
        <CapsuleButton
          className="mt-2 w-full"
          pending={callNext.isPending}
          onClick={() =>
            callNext.mutate(nextWaiting.id, {
              onSuccess: () => vibrate(),
              onError: onStale(onToast, t),
            })
          }
        >
          {fromPhoto(nextWaiting)
            ? t("ill.now.startFromPhoto", { n: nextWaiting.number, name: nextWaiting.name })
            : t("ill.now.call", { n: nextWaiting.number, name: nextWaiting.name })}
        </CapsuleButton>
        {fromPhoto(nextWaiting) ? null : (
          <button
            type="button"
            onClick={() =>
              start.mutate(nextWaiting.id, {
                onSuccess: () => vibrate(),
                onError: onStale(onToast, t),
              })
            }
            disabled={start.isPending}
            className="mt-4 h-11 w-full cursor-pointer bg-transparent px-4 py-2 text-center text-[15px] font-medium text-link disabled:cursor-default disabled:opacity-50"
          >
            {t("ill.now.startDirectly")}
          </button>
        )}
      </Card>
    );
  }

  if (current.status === "CALLED") {
    return (
      <>
        <Card>
          <TicketNumber number={current.number} size="lg" />
          <span className="text-[22px] font-semibold">{current.name}</span>
          {current.notes ? (
            <span className="text-[15px] text-label-2">&ldquo;{current.notes}&rdquo;</span>
          ) : null}
          {current.calledAt ? (
            <span className="text-[13px] text-label-2">
              {calledAgoLabel(current.calledAt, current.callCount, t)}
            </span>
          ) : null}
          <CapsuleButton
            className="mt-2 w-full"
            pending={start.isPending}
            onClick={() =>
              start.mutate(current.id, { onSuccess: () => vibrate(), onError: onStale(onToast, t) })
            }
          >
            {t("ill.now.startDrawing")}
          </CapsuleButton>
          <div className="mt-3 flex w-full gap-3">
            <CapsuleButton
              className="flex-1"
              variant="secondary"
              size="md"
              pending={recall.isPending}
              onClick={() =>
                recall.mutate(current.id, {
                  onSuccess: () => {
                    vibrate();
                    onToast(t("ill.now.recalled"));
                  },
                  onError: onStale(onToast, t),
                })
              }
            >
              {t("ill.now.recall")}
            </CapsuleButton>
            <CapsuleButton
              className="flex-1"
              variant="secondary"
              size="md"
              onClick={() => setNotHere(true)}
            >
              {t("ill.now.notHere")}
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
                    onToast(t("ill.now.backInQueue"));
                  },
                  onError: onStale(onToast, t),
                },
              );
            }}
            onNoShow={() => {
              setNotHere(false);
              noShow.mutate(current.id, {
                onSuccess: () => vibrate(),
                onError: onStale(onToast, t),
              });
            }}
            onCancel={() => setNotHere(false)}
          />
        ) : null}
      </>
    );
  }

  // SERVING, from a photo: the photo is the hero (docs/PHOTO_TICKETS.md → UI changes)
  if (fromPhoto(current)) {
    return (
      <Card>
        <span className="flex items-center gap-1.5 shape-sq bg-status-blue-bg px-2.5 py-1 text-[13px] font-semibold text-status-blue-fg">
          <Camera className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />{" "}
          {t("ill.now.drawingFromPhoto")}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[22px] font-semibold">
          <TicketNumber number={current.number} size="md" /> {current.name}
        </span>
        {current.hasPhoto ? (
          <PhotoThumb
            src={ticketPhotoUrl(current.id, photoVersion)}
            alt={t("ill.photoAlt", { name: current.name })}
            className="max-h-[52dvh] w-full shape-tile object-contain"
          />
        ) : null}
        {current.notes ? (
          <span className="text-[15px] text-label-2">&ldquo;{current.notes}&rdquo;</span>
        ) : null}
        <span className="text-[13px] text-label-2">
          {t("ill.now.drawingFor")}
          <ElapsedTimer since={current.startedAt ?? current.createdAt} />
        </span>
        <CapsuleButton
          className="mt-2 w-full"
          pending={finish.isPending}
          onClick={() =>
            finish.mutate(
              { id: current.id, callNext: true },
              { onSuccess: () => vibrate(), onError: onStale(onToast, t) },
            )
          }
        >
          {t("ill.now.finishStartNext")}
        </CapsuleButton>
        <CapsuleButton
          className="w-full"
          variant="secondary"
          pending={finish.isPending}
          onClick={() =>
            finish.mutate(
              { id: current.id, callNext: false },
              { onSuccess: () => vibrate(), onError: onStale(onToast, t) },
            )
          }
        >
          {t("ill.now.finish")}
        </CapsuleButton>
        <span className="text-[13px] text-label-2">
          {t("ill.now.finishTells", { name: current.name })}
        </span>
      </Card>
    );
  }

  // SERVING
  return (
    <Card>
      <span className="text-[15px] text-label-2">{t("ill.now.drawingForLabel")}</span>
      <span className="text-[22px] font-semibold">{current.name}</span>
      <SessionTimer
        since={current.startedAt ?? current.createdAt}
        avgSessionSec={avgSessionSec}
        className="text-[72px] leading-none"
      />
      <span className="text-[13px] text-label-2">
        {t("ill.now.usually", { n: Math.round(avgSessionSec / 60) })}
      </span>
      <CapsuleButton
        className="mt-2 w-full"
        pending={finish.isPending}
        onClick={() =>
          finish.mutate(
            { id: current.id, callNext: true },
            {
              onSuccess: () => vibrate(),
              onError: onStale(onToast, t),
            },
          )
        }
      >
        {t("ill.now.finishCallNext")}
      </CapsuleButton>
      <CapsuleButton
        className="w-full"
        variant="secondary"
        pending={finish.isPending}
        onClick={() =>
          finish.mutate(
            { id: current.id, callNext: false },
            {
              onSuccess: () => vibrate(),
              onError: onStale(onToast, t),
            },
          )
        }
      >
        {t("ill.now.finish")}
      </CapsuleButton>
    </Card>
  );
}
