import { describe, expect, it } from "vitest";
import { formatClockDuration, formatDuration, formatEtaConfidenceNote, formatEtaLine } from "./format.js";

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(45)).toBe("45 sec");
  });

  it("shows minutes under an hour", () => {
    expect(formatDuration(7 * 60)).toBe("7 min");
  });

  it("shows hours and minutes", () => {
    expect(formatDuration(65 * 60)).toBe("1h 5m");
  });

  it("omits minutes on the hour", () => {
    expect(formatDuration(120 * 60)).toBe("2h");
  });
});

describe("formatClockDuration", () => {
  it("formats under an hour as m:ss", () => {
    expect(formatClockDuration(7 * 60 + 3)).toBe("7:03");
  });

  it("formats an hour or more as h:mm:ss", () => {
    expect(formatClockDuration(3600 + 7 * 60 + 3)).toBe("1:07:03");
  });
});

describe("formatEtaLine", () => {
  it("shows 'Any moment now' under a minute", () => {
    expect(formatEtaLine({ etaSec: 30, lowSec: 24, highSec: 39, pausedUntimed: false })).toBe(
      "Any moment now",
    );
  });

  it("shows exact minutes under 10 minutes", () => {
    expect(formatEtaLine({ etaSec: 7 * 60, lowSec: 336, highSec: 546, pausedUntimed: false })).toBe(
      "~7 min",
    );
  });

  it("shows a range rounded to 5 min at or above 10 minutes", () => {
    // low 17 min, high 26 min -> rounded to 15 and 25
    expect(
      formatEtaLine({ etaSec: 20 * 60, lowSec: 17 * 60, highSec: 26 * 60, pausedUntimed: false }),
    ).toBe("~15–25 min");
  });

  it("uses the after-the-break phrasing when paused untimed", () => {
    expect(formatEtaLine({ etaSec: 11 * 60, lowSec: 0, highSec: 0, pausedUntimed: true })).toBe(
      "~11 min after the break",
    );
  });
});

describe("formatEtaConfidenceNote", () => {
  it("adds a note for low confidence", () => {
    expect(formatEtaConfidenceNote("low")).toBe("Estimate gets more accurate as the day goes on");
  });

  it("has no note for medium or high confidence", () => {
    expect(formatEtaConfidenceNote("medium")).toBeNull();
    expect(formatEtaConfidenceNote("high")).toBeNull();
  });
});
