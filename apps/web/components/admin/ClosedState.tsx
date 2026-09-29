import type { EventDTO } from "@boothq/shared";
import { CapsuleButton } from "../ui/CapsuleButton";

type ClosedStateProps = {
  event: EventDTO | null;
  onOpenBooth: () => void;
  onStartEvent: () => void;
  onChangeEvent: () => void;
};

export function ClosedState({ event, onOpenBooth, onStartEvent, onChangeEvent }: ClosedStateProps) {
  const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-label">
      <div className="flex w-full max-w-[320px] flex-col items-center gap-2 shape-card sticker bg-card px-8 py-10">
        <span className="text-[17px] font-semibold">{event ? "Booth is closed" : "No event running"}</span>
        <span className="text-[13px] text-label-2">{boothName}</span>
        {event ? (
          <div className="mt-3 flex flex-col items-center gap-0.5">
            <span className="text-[15px] font-medium">
              {event.name} · Day {event.dayCount + 1}
            </span>
            <button
              type="button"
              onClick={onChangeEvent}
              className="h-11 cursor-pointer bg-transparent px-3 text-[15px] text-link"
            >
              Change
            </button>
          </div>
        ) : null}
      </div>
      {event ? (
        <CapsuleButton onClick={onOpenBooth} className="max-w-[280px]">
          Open Booth
        </CapsuleButton>
      ) : (
        <CapsuleButton onClick={onStartEvent} className="max-w-[280px]">
          Start Event
        </CapsuleButton>
      )}
    </div>
  );
}
