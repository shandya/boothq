"use client";

import { type DayDTO, HISTORY_WINDOW, type StatsDTO } from "@boothq/shared";
import { useState } from "react";
import { useT } from "../../lib/i18n";
import { useFormat } from "../../lib/i18n/format";
import { usePatchDay } from "../../lib/queries";
import { LanguageSwitch } from "../ui/LanguageSwitch";
import { CapsuleButton } from "../ui/CapsuleButton";
import { GroupedList, GroupedRow, GroupedSeparator } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";
import { Switch } from "../ui/Switch";
import { Stepper } from "./Stepper";

type SettingsSheetProps = { day: DayDTO; stats: StatsDTO; onClose: () => void };

export function SettingsSheet({ day, stats, onClose }: SettingsSheetProps) {
  const t = useT();
  const format = useFormat();
  const [headsUpAhead, setHeadsUpAhead] = useState(day.headsUpAhead);
  const [accepting, setAccepting] = useState(day.acceptingTickets);

  const mutation = usePatchDay();

  function save() {
    mutation.mutate({ headsUpAhead, acceptingTickets: accepting }, { onSuccess: onClose });
  }

  return (
    <Sheet title={t("admin.settings.title")} onClose={onClose}>
      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <span className="text-[17px]">{t("admin.settings.accepting")}</span>
          <Switch checked={accepting} onChange={setAccepting} aria-label={t("admin.settings.acceptingAria")} />
        </GroupedRow>
      </GroupedList>

      <div className="flex flex-col gap-2">
        <GroupedList>
          <GroupedRow minHeight={52} className="justify-between">
            <span className="text-[17px]">{t("admin.settings.typical")}</span>
            <span className="text-[17px] text-label-2 tabular-nums">{format.duration(stats.avgSessionSec)}</span>
          </GroupedRow>
          <GroupedSeparator />
          <GroupedRow minHeight={52} className="justify-between">
            <span className="text-[17px]">{t("admin.settings.between")}</span>
            <span className="text-[17px] text-label-2 tabular-nums">{format.duration(stats.avgChangeoverSec)}</span>
          </GroupedRow>
        </GroupedList>
        <p className="px-4 text-[13px] text-label-2">
          {t("admin.settings.measured", { n: HISTORY_WINDOW })}
        </p>
      </div>

      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <span className="text-[17px]">{t("admin.headBack")}</span>
          <Stepper value={headsUpAhead} onChange={setHeadsUpAhead} aria-label={t("admin.peopleThreshold")} />
        </GroupedRow>
      </GroupedList>

      <GroupedList>
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <span className="text-[17px]">{t("admin.settings.language")}</span>
          <LanguageSwitch className="w-28" />
        </div>
      </GroupedList>

      <CapsuleButton onClick={save} pending={mutation.isPending}>
        {t("common.save")}
      </CapsuleButton>
    </Sheet>
  );
}
