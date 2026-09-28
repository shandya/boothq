"use client";

import { useEffect, useState } from "react";

// A local freshness indicator ("Updated 4 s ago") — measures how long ago
// this browser last successfully polled, using the device clock, not the
// server-corrected one (docs/UI.md → Customer: /t/[token]; PRD C3).
export function UpdatedAgo({ at }: { at: number | undefined }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!at) return null;

  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  const label = seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;

  return <span className="text-[12px] text-label-2">Updated {label} ago</span>;
}
