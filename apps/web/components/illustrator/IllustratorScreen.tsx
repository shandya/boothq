"use client";

import { useQuery } from "@tanstack/react-query";
import { Coffee } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout, me } from "../../lib/api";
import { onStale, vibrate } from "../../lib/feedback";
import { usePatchDay, usePauseDay, useQueue } from "../../lib/queries";
import { useWakeLock } from "../../lib/useWakeLock";
import { GlassBar } from "../ui/GlassBar";
import { OfflineBanner } from "../ui/OfflineBanner";
import { Switch } from "../ui/Switch";
import { Toast, useToast } from "../ui/Toast";
import { BreakSheet } from "./BreakSheet";
import { IllustratorHeader } from "./IllustratorHeader";
import { IllustratorMenu } from "./IllustratorMenu";
import { IllustratorNowCard } from "./IllustratorNowCard";
import { UpNextList } from "./UpNextList";

type Overlay = { type: "none" } | { type: "menu" } | { type: "break" };

export function IllustratorScreen() {
  const router = useRouter();
  const { data: snapshot, dataUpdatedAt } = useQueue();
  const roleQuery = useQuery({ queryKey: ["auth-me"], queryFn: me, retry: false });
  const wakeLock = useWakeLock();
  const patchDay = usePatchDay();
  const pauseDay = usePauseDay();
  const { message: toast, showToast } = useToast();
  const [overlay, setOverlay] = useState<Overlay>({ type: "none" });

  if (!snapshot) {
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

  if (!snapshot.day) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg px-6 text-center text-label">
        <span className="text-[22px] font-semibold">Booth is closed</span>
        <span className="text-[15px] text-label-2">Ask an admin to open the booth.</span>
      </div>
    );
  }

  const { day } = snapshot;
  const nextWaiting = snapshot.waiting[0] ?? null;

  return (
    <div className="min-h-dvh bg-bg pb-[110px] text-label">
      <OfflineBanner lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : null} />

      <div className="flex flex-col gap-3 px-4 pt-3">
        <IllustratorHeader
          day={day}
          stats={snapshot.stats}
          wakeLockActive={wakeLock.active}
          onRequestWakeLock={wakeLock.request}
          onMenu={() => setOverlay({ type: "menu" })}
        />

        <IllustratorNowCard
          day={day}
          current={snapshot.current}
          nextWaiting={nextWaiting}
          avgSessionSec={snapshot.stats.avgSessionSec}
          onToast={showToast}
        />

        <UpNextList tickets={snapshot.waiting} />
      </div>

      <GlassBar className="fixed inset-x-3 bottom-6 justify-between">
        <button
          type="button"
          onClick={() => setOverlay({ type: "break" })}
          disabled={day.paused}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-4 text-[15px] font-semibold text-link disabled:cursor-default disabled:opacity-50"
        >
          <Coffee className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Break
        </button>
        <div className="flex items-center gap-2 pr-1">
          <span className="text-[15px] font-medium text-label">Accepting</span>
          <Switch
            checked={day.acceptingTickets}
            onChange={(checked) =>
              patchDay.mutate(
                { acceptingTickets: checked },
                { onSuccess: () => vibrate(), onError: onStale(showToast) },
              )
            }
            aria-label="Accepting tickets"
          />
        </div>
      </GlassBar>

      {overlay.type === "menu" ? (
        <IllustratorMenu
          isAdmin={roleQuery.data?.role === "ADMIN"}
          onClose={() => setOverlay({ type: "none" })}
          onLogout={() => {
            void logout().then(() => router.replace("/login"));
          }}
        />
      ) : null}

      {overlay.type === "break" ? (
        <BreakSheet
          disabled={snapshot.current?.status === "SERVING"}
          pending={pauseDay.isPending}
          onClose={() => setOverlay({ type: "none" })}
          onSubmit={(input) =>
            pauseDay.mutate(input, {
              onSuccess: () => {
                setOverlay({ type: "none" });
                vibrate();
                showToast("On break");
              },
              onError: onStale(showToast),
            })
          }
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
