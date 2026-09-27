// Pure ETA function (docs/BUSINESS_LOGIC.md §5). No I/O, no clock reads —
// callers pass `now` explicitly so this stays unit-testable and reusable by
// both the API (customer ETAs, projected finish time) and its tests.

const MIN_VALID_SESSION_SEC = 60; // shorter = accidental Start/Finish, ignore
const PRIOR_WEIGHT = 3;

export type EtaInput = {
  now: Date;
  defaultDurationSec: number;
  changeoverSec: number;
  completedDurationsSec: number[]; // durationSec of DONE tickets in this Day
  current: { status: "CALLED" | "SERVING"; startedAt: Date | null } | null;
  waitingAhead: number; // WAITING tickets ahead of this one
  pause: { until: Date | null } | null; // null = not paused
};

export type EtaResult = {
  avgSessionSec: number;
  etaSec: number; // best estimate until this customer is called
  lowSec: number;
  highSec: number;
  estimatedAt: Date; // now + etaSec
  confidence: "low" | "medium" | "high";
  pausedUntimed: boolean; // true = untimed break; etaSec excludes it
};

function averageSessionSec(
  defaultDurationSec: number,
  completedDurationsSec: number[],
): { avg: number; n: number } {
  const lo = 0.25 * defaultDurationSec;
  const hi = 3 * defaultDurationSec;
  const valid = completedDurationsSec
    .filter((d) => d >= MIN_VALID_SESSION_SEC)
    .map((d) => Math.min(Math.max(d, lo), hi));

  const n = valid.length;
  const sum = valid.reduce((a, b) => a + b, 0);
  const avg =
    (sum + defaultDurationSec * Math.max(0, PRIOR_WEIGHT - n)) / Math.max(PRIOR_WEIGHT, n);

  return { avg, n };
}

export function computeEta(input: EtaInput): EtaResult {
  const { now, defaultDurationSec, changeoverSec, completedDurationsSec, current, waitingAhead, pause } =
    input;

  const { avg, n } = averageSessionSec(defaultDurationSec, completedDurationsSec);
  const cycle = avg + changeoverSec;

  let remaining = 0;
  if (current?.status === "CALLED") {
    remaining = cycle;
  } else if (current?.status === "SERVING") {
    const elapsedSec = current.startedAt ? (now.getTime() - current.startedAt.getTime()) / 1000 : 0;
    remaining = Math.max(avg - elapsedSec, 60) + changeoverSec;
  }

  const pauseRemaining = pause?.until ? Math.max((pause.until.getTime() - now.getTime()) / 1000, 0) : 0;

  const etaSec = remaining + waitingAhead * cycle + pauseRemaining;
  const confidence: EtaResult["confidence"] = n < 3 ? "low" : n < 8 ? "medium" : "high";
  const pausedUntimed = pause != null && pause.until == null;

  return {
    avgSessionSec: Math.round(avg),
    etaSec: Math.round(etaSec),
    lowSec: Math.round(etaSec * 0.8),
    highSec: Math.round(etaSec * 1.3),
    estimatedAt: new Date(now.getTime() + etaSec * 1000),
    confidence,
    pausedUntimed,
  };
}
