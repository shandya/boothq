"use client";

import { formatClockDuration } from "@boothq/shared";
import { useEffect, useState } from "react";
import { getServerNow } from "../../lib/server-time";

type ElapsedTimerProps = {
  since: string | Date;
  className?: string;
};

// Ticks every second using the server-corrected clock, not the device's own
// (docs/UI.md → Shared components: ElapsedTimer "uses server offset").
export function ElapsedTimer({ since, className }: ElapsedTimerProps) {
  const start = typeof since === "string" ? new Date(since) : since;
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.round((getServerNow().getTime() - start.getTime()) / 1000));

  return (
    <span className={className} aria-live="off">
      {formatClockDuration(elapsedSec)}
    </span>
  );
}
