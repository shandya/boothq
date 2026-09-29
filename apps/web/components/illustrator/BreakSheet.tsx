"use client";

import clsx from "clsx";
import { useState } from "react";
import { CapsuleButton } from "../ui/CapsuleButton";
import { Sheet } from "../ui/Sheet";

type BreakSheetProps = {
  onClose: () => void;
  onSubmit: (input: { minutes?: number; reason?: string }) => void;
  pending: boolean;
  disabled: boolean; // true while a ticket is SERVING
};

const PRESETS = [5, 10, 15, 30] as const;
const CUSTOM = -1;
const UNTIMED = 0;

// 5 / 10 / 15 / 30 min, Custom, or Until I'm Back, plus an optional reason
// (docs/UI.md → Illustrator: /illustrator, Break sheet).
export function BreakSheet({ onClose, onSubmit, pending, disabled }: BreakSheetProps) {
  const [choice, setChoice] = useState<number>(5);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");

  const customMinutes = Math.max(1, Math.min(240, Number(custom) || 0));
  const canSubmit = choice !== CUSTOM || custom.trim() !== "";

  function submit() {
    const minutes = choice === UNTIMED ? undefined : choice === CUSTOM ? customMinutes : choice;
    onSubmit({ minutes, reason: reason.trim() || undefined });
  }

  return (
    <Sheet title="Take a Break" onClose={onClose}>
      {disabled ? (
        <p className="m-0 px-1 text-[15px] text-label-2">Finish the current drawing first.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setChoice(minutes)}
                className={clsx(
                  "flex h-12 cursor-pointer items-center justify-center shape-tile text-[17px] font-semibold",
                  choice === minutes ? "bg-accent text-on-accent" : "bg-fill text-label",
                )}
              >
                {minutes} min
              </button>
            ))}
            <button
              type="button"
              onClick={() => setChoice(CUSTOM)}
              className={clsx(
                "flex h-12 cursor-pointer items-center justify-center shape-tile text-[17px] font-semibold",
                choice === CUSTOM ? "bg-accent text-on-accent" : "bg-fill text-label",
              )}
            >
              Custom
            </button>
            <button
              type="button"
              onClick={() => setChoice(UNTIMED)}
              className={clsx(
                "col-span-2 flex h-12 cursor-pointer items-center justify-center shape-tile text-[17px] font-semibold",
                choice === UNTIMED ? "bg-accent text-on-accent" : "bg-fill text-label",
              )}
            >
              Until I&apos;m Back
            </button>
          </div>

          {choice === CUSTOM ? (
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={240}
              placeholder="Minutes"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              className="h-11 shape-tile bg-fill px-4 text-[17px] text-label outline-none"
            />
          ) : null}

          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-11 shape-tile bg-fill px-4 text-[17px] text-label outline-none placeholder:text-label-2"
          />

          <CapsuleButton pending={pending} disabled={!canSubmit} onClick={submit}>
            Start Break
          </CapsuleButton>
        </>
      )}
    </Sheet>
  );
}
