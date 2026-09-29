import type { TicketDTO } from "@boothq/shared";
import { useState } from "react";
import { useT } from "../../lib/i18n";
import { ticketPhotoUrl } from "../../lib/photo";
import { PhotoThumb } from "../ui/PhotoViewer";
import { CapsuleButton } from "../ui/CapsuleButton";
import { Modal } from "../ui/Modal";

type TicketNoteSheetProps = {
  ticket: TicketDTO;
  onClose: () => void;
};

// Tapping an Up Next row shows the full note (docs/UI.md → Illustrator:
// /illustrator, Up next: "Tap a row for notes").
export function TicketNoteSheet({ ticket, onClose }: TicketNoteSheetProps) {
  const t = useT();
  const [photoVersion] = useState(() => Date.now());
  return (
    <Modal
      title={`#${ticket.number} ${ticket.name}`}
      onClose={onClose}
      footer={
        <CapsuleButton variant="secondary" size="md" onClick={onClose}>
          {t("common.close")}
        </CapsuleButton>
      }
    >
      {ticket.hasPhoto ? (
        <PhotoThumb
          src={ticketPhotoUrl(ticket.id, photoVersion)}
          alt={t("ill.photoAlt", { name: ticket.name })}
          className="max-h-[40dvh] w-full shape-tile object-contain"
        />
      ) : null}
      <p className="m-0 text-center text-[15px] leading-[1.4] text-label-2">
        {ticket.notes || t("ill.note.none")}
      </p>
    </Modal>
  );
}
