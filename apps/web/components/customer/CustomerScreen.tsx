"use client";

import { Camera, Copy, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import { formatClockTime } from "../../lib/format";
import { type TFunction, useT } from "../../lib/i18n";
import { useFormat } from "../../lib/i18n/format";
import { useCancelTicket, usePublicTicket } from "../../lib/queries";
import { getServerNow } from "../../lib/server-time";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { LanguageSwitch } from "../ui/LanguageSwitch";
import { OfflineBanner } from "../ui/OfflineBanner";
import { TicketNumber } from "../ui/TicketNumber";
import { Toast, useToast } from "../ui/Toast";
import { Banner } from "./Banner";
import { CalledTakeover } from "./CalledTakeover";
import { LineStrip } from "./LineStrip";
import { UpdatedAgo } from "./UpdatedAgo";

const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";
const socialHandle = process.env.NEXT_PUBLIC_SOCIAL_HANDLE;

function minutesLabel(sec: number, t: TFunction): string {
  const minutes = Math.max(1, Math.round(sec / 60));
  return minutes === 1 ? t("cust.minute1") : t("cust.minutes", { n: minutes });
}

// Copy variants from docs/BUSINESS_LOGIC.md → Heads-up.
function headsUpLines(peopleAhead: number, etaSec: number, t: TFunction): string[] {
  if (etaSec < 60) {
    return [t("cust.next"), t("cust.nextHint")];
  }
  const min = minutesLabel(etaSec, t);
  return [
    t("cust.headBack"),
    peopleAhead === 1
      ? t("cust.onlyAhead1", { min })
      : t("cust.onlyAheadN", { n: peopleAhead, min }),
  ];
}

function breakLines(pause: { until: string | null }, t: TFunction): string[] {
  if (!pause.until) return [t("cust.break")];
  const until = new Date(pause.until);
  if (until.getTime() <= getServerNow().getTime()) return [t("cust.backAnyMoment")];
  return [t("cust.breakUntil", { time: formatClockTime(until) })];
}

function cancelledLine(cancelReason: string | null, t: TFunction): string {
  if (cancelReason === "ADMIN_REMOVED") return t("cust.cancel.ADMIN_REMOVED");
  if (cancelReason === "DAY_CLOSED") return t("cust.cancel.DAY_CLOSED");
  return t("cust.cancel.default");
}

export function CustomerScreen({ token }: { token: string }) {
  const t = useT();
  const format = useFormat();
  const query = usePublicTicket(token);
  const cancel = useCancelTicket(token);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dismissedCalledAt, setDismissedCalledAt] = useState<string | null>(null);
  const { message: toast, showToast } = useToast();

  const view = query.data;

  useEffect(() => {
    if (!view) return;
    document.title =
      view.status === "READY"
        ? t("cust.title.ready", { n: view.number })
        : view.status === "CALLED" && view.mode !== "FROM_PHOTO"
          ? t("cust.title.turn", { n: view.number })
          : view.status === "WAITING" && view.almostUp
            ? t("cust.title.headBack", { n: view.number })
            : view.status === "WAITING" && view.peopleAhead != null
              ? t("cust.title.ahead", { n: view.number, ahead: view.peopleAhead })
              : `#${view.number} · ${boothName}`;
  }, [view, t]);

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg px-6 text-center text-label">
        <span className="text-[22px] font-semibold">
          {notFound ? t("cust.notFound") : t("cust.loadFailed")}
        </span>
        <span className="text-[15px] text-label-2">
          {notFound ? t("cust.lostLink") : t("cust.checkConnection")}
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
          aria-label={t("common.loading")}
        />
      </div>
    );
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(t("cust.linkCopied"));
    } catch {
      showToast(t("cust.linkCopyFailed"));
    }
  }

  // Photo tickets are drawn without the customer present: no walk-up prompts.
  const fromPhoto = view.mode === "FROM_PHOTO";

  if (
    view.status === "CALLED" &&
    !fromPhoto &&
    view.calledAt &&
    view.calledAt !== dismissedCalledAt
  ) {
    return (
      <CalledTakeover number={view.number} onDismiss={() => setDismissedCalledAt(view.calledAt)} />
    );
  }

  const canCancel = view.status === "WAITING" || view.status === "CALLED";

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-8 pt-3 text-label">
      <OfflineBanner lastUpdated={query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null} />

      <header className="flex h-11 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-semibold text-label-2">{boothName}</span>
        <LanguageSwitch className="w-24 shrink-0" />
      </header>

      {fromPhoto &&
      (view.status === "WAITING" || view.status === "CALLED" || view.status === "SERVING") ? (
        <Banner
          tone="info"
          icon={
            <Camera className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
          }
          lines={[t("cust.photoBanner")]}
        />
      ) : null}

      {view.status === "WAITING" && view.almostUp && view.eta ? (
        <Banner
          icon={
            <MapPin className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
          }
          lines={headsUpLines(view.peopleAhead ?? 0, view.eta.sec, t)}
        />
      ) : null}

      {view.status === "CALLED" && !fromPhoto ? (
        <Banner lines={[t("cust.turnBanner1"), t("cust.turnBanner2")]} />
      ) : null}

      {(view.status === "WAITING" || view.status === "CALLED") && view.pause.active ? (
        <Banner lines={breakLines(view.pause, t)} />
      ) : null}

      {view.status === "WAITING" ? (
        <>
          <div className="flex flex-col items-center gap-1.5 pt-2">
            <span className="text-[17px] text-label-2">
              {t("cust.hi", { name: view.firstName })}
            </span>
            <TicketNumber number={view.number} size="hero" />
            <span
              className={
                view.almostUp
                  ? "shape-sq bg-status-orange-bg px-2.5 py-1 text-[13px] font-semibold text-status-orange-fg"
                  : "shape-sq bg-status-gray-bg px-2.5 py-1 text-[13px] font-semibold text-status-gray-fg"
              }
            >
              {view.almostUp
                ? t("cust.chip.almostUp")
                : fromPhoto
                  ? t("cust.chip.inLineFromPhoto")
                  : t("cust.chip.inLine")}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-[17px]">
              {t("cust.nowServing")}{" "}
              <span className="font-bold tabular-nums">
                {view.nowServing ? `#${view.nowServing.number}` : "—"}
              </span>
            </span>
            <span className="text-[15px] text-label-2">
              {(view.peopleAhead ?? 0) === 0
                ? t("cust.youreNextInLine")
                : view.peopleAhead === 1
                  ? t("cust.ahead1")
                  : t("cust.aheadN", { n: view.peopleAhead ?? 0 })}
            </span>
          </div>

          {fromPhoto && view.readyEta ? (
            <div className="flex flex-col items-center gap-3 shape-card sticker bg-card p-5 text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
                  {t("cust.estReady")}
                </span>
                <span className="text-[20px] font-bold">
                  {t("cust.readyAbout", {
                    min: minutesLabel(view.readyEta.sec, t),
                    time: formatClockTime(view.readyEta.estimatedAt),
                  })}
                </span>
              </div>
              <LineStrip
                currentNumber={view.nowServing?.number ?? null}
                aheadNumbers={view.aheadNumbers}
                waitingAhead={(view.peopleAhead ?? 0) - (view.nowServing ? 1 : 0)}
                ownNumber={view.number}
              />
              <span className="text-[13px] text-label-2">
                {t("cust.basedOn", { n: Math.round(view.avgSessionSec / 60) })}
              </span>
            </div>
          ) : null}

          {!fromPhoto && view.eta ? (
            <div className="flex flex-col items-center gap-3 shape-card sticker bg-card p-5 text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
                  {t("cust.estWait")}
                </span>
                <span className="text-[20px] font-bold">
                  {format.etaLine({
                    etaSec: view.eta.sec,
                    lowSec: view.eta.lowSec,
                    highSec: view.eta.highSec,
                    pausedUntimed: view.eta.pausedUntimed,
                  })}
                  {!view.eta.pausedUntimed
                    ? t("cust.around", { time: formatClockTime(view.eta.estimatedAt) })
                    : null}
                </span>
              </div>

              <LineStrip
                currentNumber={view.nowServing?.number ?? null}
                aheadNumbers={view.aheadNumbers}
                waitingAhead={(view.peopleAhead ?? 0) - (view.nowServing ? 1 : 0)}
                ownNumber={view.number}
              />

              <span className="text-[13px] text-label-2">
                Based on the recent average drawing time of {Math.round(view.avgSessionSec / 60)}{" "}
                min.
              </span>
              {format.confidenceNote(view.eta.confidence) ? (
                <span className="text-[12px] text-label-2">
                  {format.confidenceNote(view.eta.confidence)}
                </span>
              ) : null}
            </div>
          ) : null}

          <p className="m-0 text-center text-[14px] text-label-2">
            {fromPhoto ? t("cust.photoWalk") : t("cust.walkAround")}
          </p>
        </>
      ) : null}

      {view.status === "CALLED" && fromPhoto ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[20px] font-semibold">{t("cust.upNext")}</span>
          {view.readyEta ? (
            <span className="text-[15px] text-label-2">
              {t("cust.readyIn", {
                min: minutesLabel(view.readyEta.sec, t),
                time: formatClockTime(view.readyEta.estimatedAt),
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {view.status === "CALLED" && !fromPhoto ? (
        <div className="flex flex-col items-center gap-1 pt-2">
          <TicketNumber number={view.number} size="hero" />
          <span className="text-[17px] text-label-2">
            {t("cust.hiName", { name: view.firstName })}
          </span>
        </div>
      ) : null}

      {view.status === "SERVING" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[20px] font-semibold">
            {fromPhoto ? t("cust.drawingPhoto") : t("cust.drawingNow")}
          </span>
          {fromPhoto && view.readyEta ? (
            <span className="text-[15px] text-label-2">
              {t("cust.readyIn", {
                min: minutesLabel(view.readyEta.sec, t),
                time: formatClockTime(view.readyEta.estimatedAt),
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {view.status === "READY" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="shape-sq bg-status-green-bg px-2.5 py-1 text-[13px] font-semibold text-status-green-fg">
            {t("cust.chip.ready")}
          </span>
          <TicketNumber number={view.number} size="hero" />
          <span className="text-[24px] font-bold text-status-green-fg">
            {t("cust.portraitReady")}
          </span>
          <span className="text-[17px] text-label-2">
            {view.boothOpen ? t("cust.pickupOpen") : t("cust.pickupClosed")}
          </span>
        </div>
      ) : null}

      {view.status === "DONE" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[20px] font-semibold">{t("cust.thanks")}</span>
          {socialHandle ? <span className="text-[15px] text-link">{socialHandle}</span> : null}
        </div>
      ) : null}

      {view.status === "NO_SHOW" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[17px]">{t("cust.noShow", { n: view.number })}</span>
        </div>
      ) : null}

      {view.status === "CANCELLED" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <TicketNumber number={view.number} size="lg" />
          <span className="text-[17px]">{cancelledLine(view.cancelReason, t)}</span>
        </div>
      ) : null}

      {canCancel ? (
        <div className="mt-auto flex flex-col items-center gap-3 pt-4">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex h-11 cursor-pointer items-center gap-2 shape-sq bg-fill px-5 text-[15px] font-semibold text-link"
          >
            <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {t("cust.copyLink")}
          </button>
          <UpdatedAgo at={query.dataUpdatedAt} />
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="cursor-pointer bg-transparent text-[14px] font-medium text-label-2"
          >
            {t("cust.cancelPlace")}
          </button>
        </div>
      ) : null}

      {confirmCancel ? (
        <ConfirmSheet
          title={t("cust.giveUpTitle", { n: view.number })}
          description={t("cust.giveUpDesc")}
          destructive
          confirmLabel={t("cust.giveUpConfirm")}
          pending={cancel.isPending}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() =>
            cancel.mutate(undefined, {
              onSuccess: () => setConfirmCancel(false),
              onError: (err) => {
                setConfirmCancel(false);
                showToast(
                  err instanceof ApiError && err.status === 409
                    ? t("cust.cancelStale")
                    : t("cust.cancelFailed"),
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
