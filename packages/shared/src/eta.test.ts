import { describe, expect, it } from "vitest";
import { averageValidSessionSec, computeEta, type HistoryTicket, recentHistory } from "./eta.js";

const NOW = new Date("2024-01-01T12:00:00Z");
const NO_HISTORY = { recentSessionsSec: [], recentChangeoversSec: [] };

function minutesAgo(min: number): Date {
  return new Date(NOW.getTime() - min * 60_000);
}

function minutesFromNow(min: number): Date {
  return new Date(NOW.getTime() + min * 60_000);
}

describe("computeEta", () => {
  it("1: no history, no current, waitingAhead 0", () => {
    const result = computeEta({ now: NOW, ...NO_HISTORY, current: null, waitingAhead: 0, pause: null });
    expect(result.avgSessionSec).toBe(600);
    expect(result.avgChangeoverSec).toBe(60);
    expect(result.etaSec).toBe(0);
  });

  it("2: no history, SERVING started 4 min ago, ahead 2", () => {
    const result = computeEta({
      now: NOW,
      ...NO_HISTORY,
      current: { status: "SERVING", startedAt: minutesAgo(4) },
      waitingAhead: 2,
      pause: null,
    });
    // remaining = max(600-240,60)+60 = 420; eta = 420 + 2*660
    expect(result.etaSec).toBe(1740);
  });

  it("3: sessions [300, 420, 360], CALLED, ahead 1", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [300, 420, 360],
      recentChangeoversSec: [],
      current: { status: "CALLED", startedAt: null },
      waitingAhead: 1,
      pause: null,
    });
    expect(result.avgSessionSec).toBe(360);
    expect(result.etaSec).toBe(840);
    expect(result.confidence).toBe("medium");
  });

  it("4: session [30] is ignored (below MIN_VALID)", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [30],
      recentChangeoversSec: [],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    expect(result.avgSessionSec).toBe(600);
    expect(result.confidence).toBe("low");
  });

  it("5: one session [1800] blends with the default; [9000] is dropped", () => {
    const blended = computeEta({
      now: NOW,
      recentSessionsSec: [1800],
      recentChangeoversSec: [],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    // avg = (1800 + 600*2) / 3 = 1000
    expect(blended.avgSessionSec).toBe(1000);

    const dropped = computeEta({
      now: NOW,
      recentSessionsSec: [9000],
      recentChangeoversSec: [],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    expect(dropped.avgSessionSec).toBe(600);
  });

  it("6: sessions [300, 420, 360], SERVING elapsed 900s", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [300, 420, 360],
      recentChangeoversSec: [],
      current: { status: "SERVING", startedAt: minutesAgo(15) },
      waitingAhead: 0,
      pause: null,
    });
    // remaining = max(360-900,60)+60 = 120
    expect(result.etaSec).toBe(120);
  });

  it("7: no current, ahead 0, paused until 12:10", () => {
    const result = computeEta({
      now: NOW,
      ...NO_HISTORY,
      current: null,
      waitingAhead: 0,
      pause: { until: minutesFromNow(10) },
    });
    expect(result.etaSec).toBe(600);
  });

  it("8: paused with untimed break, ahead 1, no history", () => {
    const result = computeEta({ now: NOW, ...NO_HISTORY, current: null, waitingAhead: 1, pause: { until: null } });
    expect(result.etaSec).toBe(660);
    expect(result.pausedUntimed).toBe(true);
  });

  it("9: 8 valid sessions give high confidence", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [600, 600, 600, 600, 600, 600, 600, 600],
      recentChangeoversSec: [],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    expect(result.confidence).toBe("high");
  });

  it("10: low/high are eta scaled by 0.8 and 1.3", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [1000, 1000, 1000],
      recentChangeoversSec: [0, 0, 0],
      current: null,
      waitingAhead: 1,
      pause: null,
    });
    expect(result.etaSec).toBe(1000);
    expect(result.lowSec).toBe(800);
    expect(result.highSec).toBe(1300);
  });

  it("11: only the newest 10 sessions count", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [...Array(10).fill(600), 6000],
      recentChangeoversSec: [],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    expect(result.avgSessionSec).toBe(600);
  });

  it("12: one changeover [120] blends with the 60s default", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [],
      recentChangeoversSec: [120],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    // (120 + 60*2) / 3 = 80
    expect(result.avgChangeoverSec).toBe(80);
  });

  it("13: cycle uses the measured changeover", () => {
    const result = computeEta({
      now: NOW,
      recentSessionsSec: [600, 600, 600],
      recentChangeoversSec: [120, 120, 120],
      current: null,
      waitingAhead: 2,
      pause: null,
    });
    expect(result.etaSec).toBe(1440);
  });
});

function at(min: number): Date {
  return new Date(NOW.getTime() + min * 60_000);
}

// A DONE ticket created at `created`, drawn from `start` to `end` (minutes).
function done(dayId: string, created: number, start: number, end: number): HistoryTicket {
  return {
    dayId,
    status: "DONE",
    createdAt: at(created),
    startedAt: at(start),
    endedAt: at(end),
    durationSec: (end - start) * 60,
  };
}

describe("recentHistory", () => {
  it("returns sessions newest first", () => {
    const result = recentHistory({
      tickets: [done("d1", 0, 0, 5), done("d1", 0, 6, 16)],
      pauses: [],
    });
    expect(result.sessionsSec).toEqual([600, 300]);
  });

  it("measures Finish → next Start when the next customer was already waiting", () => {
    const result = recentHistory({
      tickets: [done("d1", 0, 0, 10), done("d1", 1, 12, 22)],
      pauses: [],
    });
    expect(result.changeoversSec).toEqual([120]);
  });

  it("counts finished photo drawings (READY) as sessions", () => {
    const ready: HistoryTicket = { ...done("d1", 0, 0, 7), status: "READY", mode: "FROM_PHOTO" };
    expect(recentHistory({ tickets: [ready], pauses: [] }).sessionsSec).toEqual([420]);
  });

  it("skips gaps whose next ticket is a photo ticket", () => {
    const next: HistoryTicket = { ...done("d1", 1, 12, 22), mode: "FROM_PHOTO" };
    const result = recentHistory({ tickets: [done("d1", 0, 0, 10), next], pauses: [] });
    expect(result.changeoversSec).toEqual([]);
  });

  it("counts a started-but-not-finished ticket as the next one", () => {
    const serving: HistoryTicket = {
      dayId: "d1",
      status: "SERVING",
      createdAt: at(1),
      startedAt: at(11),
      endedAt: null,
      durationSec: null,
    };
    const result = recentHistory({ tickets: [done("d1", 0, 0, 10), serving], pauses: [] });
    expect(result.changeoversSec).toEqual([60]);
  });

  it("ignores idle gaps where the next customer arrived after Finish", () => {
    const result = recentHistory({
      tickets: [done("d1", 0, 0, 10), done("d1", 30, 31, 41)],
      pauses: [],
    });
    expect(result.changeoversSec).toEqual([]);
  });

  it("ignores gaps with a break in between", () => {
    const result = recentHistory({
      tickets: [done("d1", 0, 0, 10), done("d1", 1, 20, 30)],
      pauses: [{ dayId: "d1", at: at(11) }],
    });
    expect(result.changeoversSec).toEqual([]);
  });

  it("drops gaps over 30 minutes", () => {
    const result = recentHistory({
      tickets: [done("d1", 0, 0, 10), done("d1", 1, 45, 55)],
      pauses: [],
    });
    expect(result.changeoversSec).toEqual([]);
  });

  it("includes sessions from other Days but never pairs across Days", () => {
    const result = recentHistory({
      tickets: [done("d1", 0, 0, 10), done("d2", 5, 12, 22)],
      pauses: [],
    });
    expect(result.sessionsSec).toEqual([600, 600]);
    expect(result.changeoversSec).toEqual([]);
  });
});

describe("averageValidSessionSec", () => {
  it("averages every valid drawing, with no window and no prior", () => {
    expect(averageValidSessionSec([300, 600, 900])).toBe(600);
    expect(averageValidSessionSec(Array.from({ length: 25 }, () => 420))).toBe(420);
  });

  it("ignores accidental (<60s) and forgotten (>2h) sessions", () => {
    expect(averageValidSessionSec([10, 600, 7201])).toBe(600);
  });

  it("is 0 when there is nothing valid", () => {
    expect(averageValidSessionSec([])).toBe(0);
    expect(averageValidSessionSec([5, 30])).toBe(0);
  });
});
