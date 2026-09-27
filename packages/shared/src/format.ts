// Duration and ETA display rules (docs/BUSINESS_LOGIC.md §5 "Display rules").

import type { EtaResult } from "./eta.js";

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec} sec`;

  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin} min`;

  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

// Live session/elapsed timer, e.g. "7:03" or "1:07:03".
export function formatClockDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  const ss = String(secs).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${ss}`;
  }
  return `${mins}:${ss}`;
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

type EtaLineInput = Pick<EtaResult, "etaSec" | "lowSec" | "highSec" | "pausedUntimed">;

export function formatEtaLine(eta: EtaLineInput): string {
  if (eta.pausedUntimed) {
    return `~${Math.max(1, Math.round(eta.etaSec / 60))} min after the break`;
  }
  if (eta.etaSec < 60) return "Any moment now";
  if (eta.etaSec < 600) return `~${Math.round(eta.etaSec / 60)} min`;

  const lowMin = roundToNearest(eta.lowSec / 60, 5);
  const highMin = roundToNearest(eta.highSec / 60, 5);
  return `~${lowMin}–${highMin} min`;
}

export function formatEtaConfidenceNote(confidence: EtaResult["confidence"]): string | null {
  return confidence === "low" ? "Estimate gets more accurate as the day goes on" : null;
}
