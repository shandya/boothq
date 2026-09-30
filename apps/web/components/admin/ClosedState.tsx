import type { EventDTO, TicketDTO } from "@boothq/shared";
import Link from "next/link";
import { useT } from "../../lib/i18n";
import { LanguageSwitch } from "../ui/LanguageSwitch";
import { CapsuleButton } from "../ui/CapsuleButton";
import { ReadyForPickupSection } from "./ReadyForPickupSection";

type ClosedStateProps = {
  event: EventDTO | null;
  onOpenBooth: () => void;
  onStartEvent: () => void;
  onChangeEvent: () => void;
  readyForPickup: TicketDTO[]; // portraits from earlier Days still waiting to be collected
  onToast: (message: string) => void;
};

export function ClosedState({ event, onOpenBooth, onStartEvent, onChangeEvent, readyForPickup, onToast }: ClosedStateProps) {
  const t = useT();
  const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? t("common.the_booth");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-label">
      <div className="flex w-full max-w-[320px] flex-col items-center gap-2 shape-card sticker bg-card px-8 py-10">
        <span className="text-[17px] font-semibold">{event ? t("admin.closed.event") : t("admin.closed.noEvent")}</span>
        <span className="text-[13px] text-label-2">{boothName}</span>
        {event ? (
          <div className="mt-3 flex flex-col items-center gap-0.5">
            <span className="text-[15px] font-medium">
              {t("admin.closed.eventDay", { name: event.name, n: event.dayCount + 1 })}
            </span>
            <button
              type="button"
              onClick={onChangeEvent}
              className="h-11 cursor-pointer bg-transparent px-3 text-[15px] text-link"
            >
              {t("admin.closed.change")}
            </button>
          </div>
        ) : null}
      </div>
      {event ? (
        <CapsuleButton onClick={onOpenBooth} className="max-w-[280px]">
          {t("admin.closed.open")}
        </CapsuleButton>
      ) : (
        <CapsuleButton onClick={onStartEvent} className="max-w-[280px]">
          {t("admin.closed.startEvent")}
        </CapsuleButton>
      )}
      {readyForPickup.length > 0 ? (
        <div className="w-full max-w-[380px] text-left">
          <ReadyForPickupSection tickets={readyForPickup} onToast={onToast} />
        </div>
      ) : null}
      <Link href="/admin/history" className="flex h-11 items-center text-[17px] text-link no-underline">
        {t("admin.closed.history")}
      </Link>
      <LanguageSwitch className="w-28" />
    </div>
  );
}
