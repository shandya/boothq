"use client";

import type { EtaResult } from "@boothq/shared";
import { useMemo } from "react";
import { type TFunction, useT } from "./index";

export function formatDurationT(t: TFunction, totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return t("fmt.sec", { n: sec });

  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return t("fmt.min", { n: totalMin });

  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins === 0 ? t("fmt.hours", { h: hours }) : t("fmt.hoursMin", { h: hours, m: mins });
}

const roundToNearest = (value: number, step: number) => Math.round(value / step) * step;

type EtaLineInput = Pick<EtaResult, "etaSec" | "lowSec" | "highSec" | "pausedUntimed">;

// Same rules as @boothq/shared's formatEtaLine, in the reader's language.
export function formatEtaLineT(t: TFunction, eta: EtaLineInput): string {
  if (eta.pausedUntimed)
    return t("fmt.etaAfterBreak", { n: Math.max(1, Math.round(eta.etaSec / 60)) });
  if (eta.etaSec < 60) return t("fmt.etaAnyMoment");
  if (eta.etaSec < 600) return t("fmt.etaMin", { n: Math.round(eta.etaSec / 60) });
  return t("fmt.etaRange", {
    low: roundToNearest(eta.lowSec / 60, 5),
    high: roundToNearest(eta.highSec / 60, 5),
  });
}

export function useFormat() {
  const t = useT();
  return useMemo(
    () => ({
      duration: (sec: number) => formatDurationT(t, sec),
      etaLine: (eta: EtaLineInput) => formatEtaLineT(t, eta),
      confidenceNote: (confidence: EtaResult["confidence"]) =>
        confidence === "low" ? t("fmt.confidenceLow") : null,
    }),
    [t],
  );
}
