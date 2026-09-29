"use client";

import { useState } from "react";
import { useT } from "../../lib/i18n";
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
  const t = useT();
  const [headsUpAhead, setHeadsUpAhead] = useState(3);

  return (
    <Sheet title={t("admin.open.title")} onClose={onClose}>
      <GroupedList>
        <GroupedRow minHeight={52} className="justify-between">
          <span className="text-[17px]">{t("admin.headBack")}</span>
          <Stepper value={headsUpAhead} onChange={setHeadsUpAhead} aria-label={t("admin.peopleThreshold")} />
        </GroupedRow>
      </GroupedList>

      <CapsuleButton pending={pending} onClick={() => onSubmit({ headsUpAhead })}>
        {t("admin.open.title")}
      </CapsuleButton>
    </Sheet>
  );
}
