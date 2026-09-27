"use client";

import { useState } from "react";
import { CapsuleButton } from "../ui/CapsuleButton";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";
import { Stepper } from "./Stepper";

type OpenBoothSheetProps = {
  onClose: () => void;
  onSubmit: (input: { defaultDurationSec: number; changeoverSec: number; headsUpAhead: number }) => void;
  pending: boolean;
};

export function OpenBoothSheet({ onClose, onSubmit, pending }: OpenBoothSheetProps) {
  const [typicalMin, setTypicalMin] = useState(10);
  const [betweenMin, setBetweenMin] = useState(1);
  const [headsUpAhead, setHeadsUpAhead] = useState(3);

  return (
    <Sheet title="Open Booth" onClose={onClose}>
      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <label htmlFor="ob-typical" className="text-[17px]">
            Typical drawing time
          </label>
          <div className="flex items-center gap-1">
            <input
              id="ob-typical"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={typicalMin}
              onChange={(event) => setTypicalMin(Math.max(1, Number(event.target.value) || 1))}
              className="w-12 border-none bg-transparent text-right text-[17px] text-label outline-none"
            />
            <span className="text-[15px] text-label-2">min</span>
          </div>
        </GroupedRow>
        <GroupedSeparator />
        <GroupedRow minHeight={52} className="justify-between">
          <label htmlFor="ob-between" className="text-[17px]">
            Time between customers
          </label>
          <div className="flex items-center gap-1">
            <input
              id="ob-between"
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              value={betweenMin}
              onChange={(event) => setBetweenMin(Math.max(0, Number(event.target.value) || 0))}
              className="w-12 border-none bg-transparent text-right text-[17px] text-label outline-none"
            />
            <span className="text-[15px] text-label-2">min</span>
          </div>
        </GroupedRow>
      </GroupedList>

      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <span className="text-[17px]">Head back when ahead by</span>
          <Stepper value={headsUpAhead} onChange={setHeadsUpAhead} aria-label="People ahead threshold" />
        </GroupedRow>
      </GroupedList>

      <CapsuleButton
        pending={pending}
        onClick={() =>
          onSubmit({
            defaultDurationSec: typicalMin * 60,
            changeoverSec: betweenMin * 60,
            headsUpAhead,
          })
        }
      >
        Open Booth
      </CapsuleButton>
    </Sheet>
  );
}
