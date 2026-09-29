import type { TicketDTO } from "@boothq/shared";
import { CapsuleButton } from "../ui/CapsuleButton";
import { Modal } from "../ui/Modal";

type TicketNoteSheetProps = {
  ticket: TicketDTO;
  onClose: () => void;
};

// Tapping an Up Next row shows the full note (docs/UI.md → Illustrator:
// /illustrator, Up next: "Tap a row for notes").
export function TicketNoteSheet({ ticket, onClose }: TicketNoteSheetProps) {
  return (
    <Modal
      title={`#${ticket.number} ${ticket.name}`}
      onClose={onClose}
      footer={
        <CapsuleButton variant="secondary" size="md" onClick={onClose}>
          Close
        </CapsuleButton>
      }
    >
      <p className="m-0 text-center text-[15px] leading-[1.4] text-label-2">{ticket.notes || "No notes"}</p>
    </Modal>
  );
}
