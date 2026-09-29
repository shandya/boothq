// Pure ETA function (docs/BUSINESS_LOGIC.md §5). No I/O, no clock reads —
// callers pass `now` explicitly so this stays unit-testable and reusable by
// both the API (customer ETAs, projected finish time) and its tests.

export const DEFAULT_SESSION_SEC = 600;
export const DEFAULT_CHANGEOVER_SEC = 60;
export const HISTORY_WINDOW = 10;

const MIN_VALID_SESSION_SEC = 60; // shorter = accidental Start/Finish, ignore
const MAX_VALID_SESSION_SEC = 7200;
const MAX_VALID_CHANGEOVER_SEC = 1800;
const PRIOR_WEIGHT = 3;

export type EtaInput = {
  now: Date;
  recentSessionsSec: number[]; // newest first; see recentHistory()
  recentChangeoversSec: number[]; // newest first; see recentHistory()
  current: { status: "CALLED" | "SERVING"; startedAt: Date | null } | null;
  waitingAhead: number; // WAITING tickets ahead of this one
  pause: { until: Date | null } | null; // null = not paused
};

export type EtaResult = {
  avgSessionSec: number;
  avgChangeoverSec: number;
  etaSec: number; // best estimate until this customer is called
  lowSec: number;
  highSec: number;
  estimatedAt: Date; // now + etaSec
  confidence: "low" | "medium" | "high";
  pausedUntimed: boolean; // true = untimed break; etaSec excludes it
};

function validSessions(values: number[]): number[] {
  return values.filter((d) => d >= MIN_VALID_SESSION_SEC && d <= MAX_VALID_SESSION_SEC).slice(0, HISTORY_WINDOW);
}

function validChangeovers(values: number[]): number[] {
  return values.filter((g) => g >= 0 && g <= MAX_VALID_CHANGEOVER_SEC).slice(0, HISTORY_WINDOW);
}

// Blends the built-in default in until PRIOR_WEIGHT samples exist, so the
// first one or two measurements don't swing the estimate.
function blendedAverage(valid: number[], prior: number): number {
  const n = valid.length;
  const sum = valid.reduce((a, b) => a + b, 0);
  return (sum + prior * Math.max(0, PRIOR_WEIGHT - n)) / Math.max(PRIOR_WEIGHT, n);
}

export function computeEta(input: EtaInput): EtaResult {
  const { now, recentSessionsSec, recentChangeoversSec, current, waitingAhead, pause } = input;

  const sessions = validSessions(recentSessionsSec);
  const avg = blendedAverage(sessions, DEFAULT_SESSION_SEC);
  const changeover = blendedAverage(validChangeovers(recentChangeoversSec), DEFAULT_CHANGEOVER_SEC);
  const cycle = avg + changeover;
  const n = sessions.length;

  let remaining = 0;
  if (current?.status === "CALLED") {
    remaining = cycle;
  } else if (current?.status === "SERVING") {
    const elapsedSec = current.startedAt ? (now.getTime() - current.startedAt.getTime()) / 1000 : 0;
    remaining = Math.max(avg - elapsedSec, 60) + changeover;
  }

  const pauseRemaining = pause?.until ? Math.max((pause.until.getTime() - now.getTime()) / 1000, 0) : 0;

  const etaSec = remaining + waitingAhead * cycle + pauseRemaining;
  const confidence: EtaResult["confidence"] = n < 3 ? "low" : n < 8 ? "medium" : "high";
  const pausedUntimed = pause != null && pause.until == null;

  return {
    avgSessionSec: Math.round(avg),
    avgChangeoverSec: Math.round(changeover),
    etaSec: Math.round(etaSec),
    lowSec: Math.round(etaSec * 0.8),
    highSec: Math.round(etaSec * 1.3),
    estimatedAt: new Date(now.getTime() + etaSec * 1000),
    confidence,
    pausedUntimed,
  };
}

export type HistoryTicket = {
  dayId: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSec: number | null;
};

export type HistoryPause = { dayId: string; at: Date };

export type RecentHistory = { sessionsSec: number[]; changeoversSec: number[] };

// Measures drawing times and Finish → next Start gaps from whatever tickets
// the caller passes (the caller decides the scope, e.g. which Days count).
// A gap only counts when the next customer was already in line at Finish and
// no break started in between, so idle time and breaks don't inflate it.
export function recentHistory(input: { tickets: HistoryTicket[]; pauses: HistoryPause[] }): RecentHistory {
  const done = input.tickets
    .filter((t): t is HistoryTicket & { endedAt: Date } => t.status === "DONE" && t.endedAt != null)
    .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());

  const sessionsSec = validSessions(done.flatMap((t) => (t.durationSec != null ? [t.durationSec] : [])));

  const started = input.tickets.filter((t): t is HistoryTicket & { startedAt: Date } => t.startedAt != null);
  const gaps: number[] = [];
  for (const prev of done) {
    const finishedAt = prev.endedAt.getTime();
    let next: (HistoryTicket & { startedAt: Date }) | null = null;
    for (const t of started) {
      if (t.dayId !== prev.dayId || t.startedAt.getTime() <= finishedAt) continue;
      if (!next || t.startedAt.getTime() < next.startedAt.getTime()) next = t;
    }
    if (!next || next.createdAt.getTime() > finishedAt) continue;

    const nextStart = next.startedAt.getTime();
    const pausedBetween = input.pauses.some(
      (p) => p.dayId === prev.dayId && p.at.getTime() > finishedAt && p.at.getTime() < nextStart,
    );
    if (pausedBetween) continue;

    gaps.push(Math.round((nextStart - finishedAt) / 1000));
  }

  return { sessionsSec, changeoversSec: validChangeovers(gaps) };
}
