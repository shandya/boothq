import { describe, expect, it } from "vitest";
import { computeEta } from "./eta.js";

const NOW = new Date("2024-01-01T12:00:00Z");
const DEFAULTS = { defaultDurationSec: 600, changeoverSec: 60 };

function minutesAgo(min: number): Date {
  return new Date(NOW.getTime() - min * 60_000);
}

function minutesFromNow(min: number): Date {
  return new Date(NOW.getTime() + min * 60_000);
}

describe("computeEta", () => {
  it("1: no history, no current, waitingAhead 0", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    expect(result.avgSessionSec).toBe(600);
    expect(result.etaSec).toBe(0);
  });

  it("2: no history, SERVING started 4 min ago, ahead 2", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [],
      current: { status: "SERVING", startedAt: minutesAgo(4) },
      waitingAhead: 2,
      pause: null,
    });
    // remaining = max(600-240,60)+60 = 420; eta = 420 + 2*660
    expect(result.etaSec).toBe(1740);
  });

  it("3: history [300, 420, 360], CALLED, ahead 1", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [300, 420, 360],
      current: { status: "CALLED", startedAt: null },
      waitingAhead: 1,
      pause: null,
    });
    expect(result.avgSessionSec).toBe(360);
    expect(result.etaSec).toBe(840);
    expect(result.confidence).toBe("medium");
  });

  it("4: history [30] is ignored (below MIN_VALID)", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [30],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    expect(result.avgSessionSec).toBe(600);
    expect(result.confidence).toBe("low");
  });

  it("5: history [5000] is clamped to 1800", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [5000],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    // avg = (1800 + 600*2) / 3 = 1000
    expect(result.avgSessionSec).toBe(1000);
  });

  it("6: history [300, 420, 360], SERVING elapsed 900s", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [300, 420, 360],
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
      ...DEFAULTS,
      completedDurationsSec: [],
      current: null,
      waitingAhead: 0,
      pause: { until: minutesFromNow(10) },
    });
    expect(result.etaSec).toBe(600);
  });

  it("8: paused with untimed break, ahead 1, no history", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [],
      current: null,
      waitingAhead: 1,
      pause: { until: null },
    });
    expect(result.etaSec).toBe(660);
    expect(result.pausedUntimed).toBe(true);
  });

  it("9: 8 valid history items give high confidence", () => {
    const result = computeEta({
      now: NOW,
      ...DEFAULTS,
      completedDurationsSec: [600, 600, 600, 600, 600, 600, 600, 600],
      current: null,
      waitingAhead: 0,
      pause: null,
    });
    expect(result.confidence).toBe("high");
  });

  it("10: low/high are eta scaled by 0.8 and 1.3", () => {
    const result = computeEta({
      now: NOW,
      defaultDurationSec: 1000,
      changeoverSec: 0,
      completedDurationsSec: [],
      current: null,
      waitingAhead: 1,
      pause: null,
    });
    expect(result.etaSec).toBe(1000);
    expect(result.lowSec).toBe(800);
    expect(result.highSec).toBe(1300);
  });
});
