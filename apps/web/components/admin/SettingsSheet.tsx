"use client";

import { type DayDTO, formatDuration, HISTORY_WINDOW, type StatsDTO } from "@boothq/shared";
import { useState } from "react";
import { usePatchDay } from "../../lib/queries";
import { CapsuleButton } from "../ui/CapsuleButton";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";
import { Switch } from "../ui/Switch";
import { Stepper } from "./Stepper";

type SettingsSheetProps = { day: DayDTO; stats: StatsDTO; onClose: () => void };

export function SettingsSheet({ day, stats, onClose }: SettingsSheetProps) {
  const [headsUpAhead, setHeadsUpAhead] = useState(day.headsUpAhead);
  const [accepting, setAccepting] = useState(day.acceptingTickets);

  const mutation = usePatchDay();

  function save() {
    mutation.mutate({ headsUpAhead, acceptingTickets: accepting }, { onSuccess: onClose });
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <span className="text-[17px]">Accepting Tickets</span>
          <Switch checked={accepting} onChange={setAccepting} aria-label="Accepting tickets" />
        </GroupedRow>
      </GroupedList>

      <div className="flex flex-col gap-2">
        <GroupedList>
          <GroupedRow minHeight={52} className="justify-between">
            <span className="text-[17px]">Typical drawing time</span>
            <span className="text-[17px] text-label-2 tabular-nums">{formatDuration(stats.avgSessionSec)}</span>
          </GroupedRow>
          <GroupedSeparator />
          <GroupedRow minHeight={52} className="justify-between">
            <span className="text-[17px]">Time between customers</span>
            <span className="text-[17px] text-label-2 tabular-nums">{formatDuration(stats.avgChangeoverSec)}</span>
          </GroupedRow>
        </GroupedList>
        <p className="px-4 text-[13px] text-label-2">
          Measured from the last {HISTORY_WINDOW} customers at this event. Used for wait-time estimates.
        </p>
      </div>

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
