import { CapsuleButton } from "./CapsuleButton";
import { Modal } from "./Modal";

type NotHereSheetProps = {
  onRequeue: (afterCount: number) => void;
  onNoShow: () => void;
  onCancel: () => void;
};

// Shown on a CALLED ticket when the customer isn't there
// (docs/UI.md → Illustrator: /illustrator, admin Ticket sheet).
export function NotHereSheet({ onRequeue, onNoShow, onCancel }: NotHereSheetProps) {
  return (
    <Modal
      title="Not here right now?"
      onClose={onCancel}
      footer={
        <>
          <CapsuleButton variant="primary" size="md" onClick={() => onRequeue(2)}>
            Put Back 2 Places
          </CapsuleButton>
          <CapsuleButton variant="destructive" size="md" onClick={onNoShow}>
            Mark No-Show
          </CapsuleButton>
          <CapsuleButton variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </CapsuleButton>
        </>
      }
    />
  );
}
