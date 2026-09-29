"use client";

import { formatClockDuration } from "@boothq/shared/format";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { getServerNow } from "../../lib/server-time";

type SessionTimerProps = {
  since: string;
  avgSessionSec: number;
  className?: string;
};

// Plain elapsed timer for a SERVING ticket; text turns orange past the
// day's average session length and --danger past 1.5x
// (docs/UI.md → Illustrator: /illustrator, Now card by state → SERVING).
export function SessionTimer({ since, avgSessionSec, className }: SessionTimerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(
    0,
    Math.round((getServerNow().getTime() - new Date(since).getTime()) / 1000),
  );
  const pace =
    elapsedSec > avgSessionSec * 1.5 ? "danger" : elapsedSec > avgSessionSec ? "orange" : "normal";

  return (
    <span
      className={clsx(
        "font-bold tabular-nums",
        pace === "danger"
          ? "text-danger"
          : pace === "orange"
            ? "text-status-orange-fg"
            : "text-label",
        className,
      )}
      aria-live="off"
    >
      {formatClockDuration(elapsedSec)}
    </span>
  );
}
