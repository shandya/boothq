import { GroupedSeparator } from "./GroupedList";

type NotHereSheetProps = {
  onRequeue: (afterCount: number) => void;
  onNoShow: () => void;
  onCancel: () => void;
};

// Shown on a CALLED ticket when the customer isn't there
// (docs/UI.md → Illustrator: /illustrator, admin Ticket sheet).
export function NotHereSheet({ onRequeue, onNoShow, onCancel }: NotHereSheetProps) {
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-dim" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-x-8 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-[20px] bg-sheet shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="px-5 py-4 text-center text-[13px] text-label-2">Not here right now?</div>
        <GroupedSeparator inset={0} />
        <button type="button" onClick={() => onRequeue(2)} className="h-11 cursor-pointer bg-transparent text-[17px] text-link">
          Put Back 2 Places
        </button>
        <GroupedSeparator inset={0} />
        <button type="button" onClick={onNoShow} className="h-11 cursor-pointer bg-transparent text-[17px] text-danger">
          Mark No-Show
        </button>
        <GroupedSeparator inset={0} />
        <button type="button" onClick={onCancel} className="h-11 cursor-pointer bg-transparent text-[17px] font-semibold text-link">
          Cancel
        </button>
      </div>
    </div>
  );
}
