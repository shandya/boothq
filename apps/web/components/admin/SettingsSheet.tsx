"use client";

import type { DayDTO } from "@boothq/shared";
import { useState } from "react";
import { usePatchDay } from "../../lib/queries";
import { CapsuleButton } from "../ui/CapsuleButton";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";
import { Switch } from "../ui/Switch";
import { Stepper } from "./Stepper";

export function SettingsSheet({ day, onClose }: { day: DayDTO; onClose: () => void }) {
  const [typicalMin, setTypicalMin] = useState(Math.round(day.defaultDurationSec / 60));
  const [betweenMin, setBetweenMin] = useState(Math.round(day.changeoverSec / 60));
  const [headsUpAhead, setHeadsUpAhead] = useState(day.headsUpAhead);
  const [accepting, setAccepting] = useState(day.acceptingTickets);

  const mutation = usePatchDay();

  function save() {
    mutation.mutate(
      {
        defaultDurationSec: typicalMin * 60,
        changeoverSec: betweenMin * 60,
        headsUpAhead,
        acceptingTickets: accepting,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <span className="text-[17px]">Accepting Tickets</span>
          <Switch checked={accepting} onChange={setAccepting} aria-label="Accepting tickets" />
        </GroupedRow>
      </GroupedList>

      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <label htmlFor="st-typical" className="text-[17px]">
            Typical drawing time
          </label>
          <div className="flex items-center gap-1">
            <input
              id="st-typical"
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
          <label htmlFor="st-between" className="text-[17px]">
            Time between customers
          </label>
          <div className="flex items-center gap-1">
            <input
              id="st-between"
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

      <CapsuleButton onClick={save} pending={mutation.isPending}>
        Save
      </CapsuleButton>
    </Sheet>
  );
}
