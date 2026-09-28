import type { TicketDTO } from "@boothq/shared";
import { GroupedSeparator } from "../ui/GroupedList";

type TicketNoteSheetProps = {
  ticket: TicketDTO;
  onClose: () => void;
};

// Tapping an Up Next row shows the full note (docs/UI.md → Illustrator:
// /illustrator, Up next: "Tap a row for notes").
export function TicketNoteSheet({ ticket, onClose }: TicketNoteSheetProps) {
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-x-8 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-[20px] bg-sheet shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col items-center gap-1.5 px-5 py-4 text-center">
          <span className="text-[17px] font-semibold">
            #{ticket.number} {ticket.name}
          </span>
          <span className="text-[15px] leading-[1.4] text-label-2">{ticket.notes || "No notes"}</span>
        </div>
        <GroupedSeparator inset={0} />
        <button
          type="button"
          onClick={onClose}
          className="h-11 cursor-pointer bg-transparent text-[17px] font-semibold text-link"
        >
          Close
        </button>
      </div>
    </div>
  );
}
