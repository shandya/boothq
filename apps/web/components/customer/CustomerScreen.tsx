"use client";

import { formatEtaConfidenceNote, formatEtaLine } from "@boothq/shared/format";
import { Copy, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import { formatClockTime } from "../../lib/format";
import { useCancelTicket, usePublicTicket } from "../../lib/queries";
import { getServerNow } from "../../lib/server-time";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { OfflineBanner } from "../ui/OfflineBanner";
import { TicketNumber } from "../ui/TicketNumber";
import { Toast, useToast } from "../ui/Toast";
import { Banner } from "./Banner";
import { CalledTakeover } from "./CalledTakeover";
import { LineStrip } from "./LineStrip";
import { UpdatedAgo } from "./UpdatedAgo";

const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";
const socialHandle = process.env.NEXT_PUBLIC_SOCIAL_HANDLE;

function minutesLabel(sec: number): string {
  const minutes = Math.max(1, Math.round(sec / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

// Copy variants from docs/BUSINESS_LOGIC.md → Heads-up.
function headsUpLines(peopleAhead: number, etaSec: number): string[] {
  if (etaSec < 60) {
    return ["You're next", "Please come to the booth now so you're ready."];
  }
  const who = peopleAhead === 1 ? "1 person" : `${peopleAhead} people`;
  return [
    "Start heading back to the booth",
    `Only ${who} ahead of you. Your turn is in about ${minutesLabel(etaSec)}.`,
  ];
}

function breakLines(pause: { until: string | null }): string[] {
  if (!pause.until) return ["The illustrator is on a short break"];
  const until = new Date(pause.until);
  if (until.getTime() <= getServerNow().getTime()) return ["Back any moment"];
  return [`The illustrator is on a short break until ${formatClockTime(until)}`];
}

function cancelledLine(cancelReason: string | null): string {
  if (cancelReason === "ADMIN_REMOVED") return "This ticket was removed. Please ask at the booth.";
  if (cancelReason === "DAY_CLOSED") return "The booth has closed for today.";
  return "This ticket is cancelled.";
}

export function CustomerScreen({ token }: { token: string }) {
  const query = usePublicTicket(token);
  const cancel = useCancelTicket(token);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dismissedCalledAt, setDismissedCalledAt] = useState<string | null>(null);
  const { message: toast, showToast } = useToast();

  const view = query.data;

  useEffect(() => {
    if (!view) return;
    document.title =
      view.status === "CALLED"
        ? `#${view.number} · Your turn!`
        : view.status === "WAITING" && view.almostUp
          ? `#${view.number} · Head back now`
          : view.status === "WAITING" && view.peopleAhead != null
            ? `#${view.number} · ${view.peopleAhead} ahead`
            : `#${view.number} · BoothQ`;
  }, [view]);

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg px-6 text-center text-label">
        <span className="text-[22px] font-semibold">{notFound ? "Ticket not found" : "Couldn't load your ticket"}</span>
        <span className="text-[15px] text-label-2">
          {notFound ? "If you lost your link, ask at the booth." : "Check your connection and try again."}
        </span>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-fill border-t-label-2"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied");
    } catch {
      showToast("Couldn't copy link");
    }
  }

  if (view.status === "CALLED" && view.calledAt && view.calledAt !== dismissedCalledAt) {
    return <CalledTakeover number={view.number} onDismiss={() => setDismissedCalledAt(view.calledAt)} />;
  }

  const canCancel = view.status === "WAITING" || view.status === "CALLED";

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-8 pt-3 text-label">
      <OfflineBanner lastUpdated={query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null} />

      <header className="flex h-11 items-center justify-center">
        <span className="text-[15px] font-semibold text-label-2">{boothName}</span>
      </header>

      {view.status === "WAITING" && view.almostUp && view.eta ? (
        <Banner
          icon={<MapPin className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />}
          lines={headsUpLines(view.peopleAhead ?? 0, view.eta.sec)}
        />
      ) : null}

      {view.status === "CALLED" ? <Banner lines={["It's your turn", "Please come to the booth now."]} /> : null}

      {(view.status === "WAITING" || view.status === "CALLED") && view.pause.active ? (
        <Banner lines={breakLines(view.pause)} />
      ) : null}

      {view.status === "WAITING" ? (
        <>
          <div className="flex flex-col items-center gap-1.5 pt-2">
            <span className="text-[17px] text-label-2">Hi {view.firstName}, your number</span>
            <TicketNumber number={view.number} size="hero" />
            <span
              className={
                view.almostUp
                  ? "rounded-full bg-status-orange-bg px-2.5 py-1 text-[13px] font-semibold text-status-orange-fg"
                  : "rounded-full bg-status-gray-bg px-2.5 py-1 text-[13px] font-semibold text-status-gray-fg"
              }
            >
              {view.almostUp ? "Almost up" : "In line"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-[17px]">
              Now serving{" "}
              <span className="font-bold tabular-nums">{view.nowServing ? `#${view.nowServing.number}` : "—"}</span>
            </span>
            <span className="text-[15px] text-label-2">
              {(view.peopleAhead ?? 0) === 0
                ? "You're next in line"
                : view.peopleAhead === 1
                  ? "1 person ahead of you"
                  : `${view.peopleAhead} people ahead of you`}
            </span>
          </div>

          {view.eta ? (
            <div className="flex flex-col items-center gap-3 shape-card sticker bg-card p-5 text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
                  Estimated wait
                </span>
                <span className="text-[20px] font-bold">
                  {formatEtaLine({
                    etaSec: view.eta.sec,
                    lowSec: view.eta.lowSec,
                    highSec: view.eta.highSec,
                    pausedUntimed: view.eta.pausedUntimed,
                  })}
                  {!view.eta.pausedUntimed ? <> &middot; around {formatClockTime(view.eta.estimatedAt)}</> : null}
                </span>
              </div>

              <LineStrip
                currentNumber={view.nowServing?.number ?? null}
                aheadNumbers={view.aheadNumbers}
                waitingAhead={(view.peopleAhead ?? 0) - (view.nowServing ? 1 : 0)}
                ownNumber={view.number}
              />

              <span className="text-[13px] text-label-2">
                Based on the recent average drawing time of {Math.round(view.avgSessionSec / 60)} min.
              </span>
              {formatEtaConfidenceNote(view.eta.confidence) ? (
                <span className="text-[12px] text-label-2">{formatEtaConfidenceNote(view.eta.confidence)}</span>
              ) : null}
            </div>
          ) : null}

          <p className="m-0 text-center text-[14px] text-label-2">Feel free to walk around — keep this page open.</p>
        </>
      ) : null}

      {view.status === "CALLED" ? (
        <div className="flex flex-col items-center gap-1 pt-2">
          <TicketNumber number={view.number} size="hero" />
          <span className="text-[17px] text-label-2">Hi {view.firstName}</span>
        </div>
      ) : null}

      {view.status === "SERVING" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[20px] font-semibold">You&apos;re being drawn right now ✏️</span>
        </div>
      ) : null}

      {view.status === "DONE" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[20px] font-semibold">Thanks for visiting!</span>
          {socialHandle ? <span className="text-[15px] text-link">{socialHandle}</span> : null}
        </div>
      ) : null}

      {view.status === "NO_SHOW" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[17px]">
            We called #{view.number} but couldn&apos;t find you. Please come to the booth and we&apos;ll fit you back
            in.
          </span>
        </div>
      ) : null}

      {view.status === "CANCELLED" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[17px]">{cancelledLine(view.cancelReason)}</span>
        </div>
      ) : null}

      {canCancel ? (
        <div className="mt-auto flex flex-col items-center gap-3 pt-4">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-fill px-5 text-[15px] font-semibold text-link"
          >
            <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Copy Link
          </button>
          <UpdatedAgo at={query.dataUpdatedAt} />
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="cursor-pointer bg-transparent text-[14px] font-medium text-label-2"
          >
            Cancel my place
          </button>
        </div>
      ) : null}

      {confirmCancel ? (
        <ConfirmSheet
          title={`Give up your place (#${view.number})?`}
          description="This can't be undone."
          destructive
          confirmLabel="Give Up My Place"
          pending={cancel.isPending}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() =>
            cancel.mutate(undefined, {
              onSuccess: () => setConfirmCancel(false),
              onError: (err) => {
                setConfirmCancel(false);
                showToast(
                  err instanceof ApiError && err.status === 409
                    ? "Your ticket can't be cancelled anymore"
                    : "Couldn't cancel. Try again.",
                );
                void query.refetch();
              },
            })
          }
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
