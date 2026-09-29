"use client";

import { useState } from "react";
import { CapsuleButton } from "../ui/CapsuleButton";
import { GroupedList, GroupedRow } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";
import { Stepper } from "./Stepper";

type OpenBoothSheetProps = {
  onClose: () => void;
  onSubmit: (input: { headsUpAhead: number }) => void;
  pending: boolean;
};

export function OpenBoothSheet({ onClose, onSubmit, pending }: OpenBoothSheetProps) {
  const [headsUpAhead, setHeadsUpAhead] = useState(3);

  return (
    <Sheet title="Open Booth" onClose={onClose}>
      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <span className="text-[17px]">Head back when ahead by</span>
          <Stepper value={headsUpAhead} onChange={setHeadsUpAhead} aria-label="People ahead threshold" />
        </GroupedRow>
      </GroupedList>

      <CapsuleButton pending={pending} onClick={() => onSubmit({ headsUpAhead })}>
        Open Booth
      </CapsuleButton>
    </Sheet>
  );
}
