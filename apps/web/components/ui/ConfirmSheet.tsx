import { CapsuleButton } from "./CapsuleButton";
import { Modal } from "./Modal";

type ConfirmSheetProps = {
  title: string;
  description?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// Confirmations that name the customer (docs/UI.md → Design principles) and
// the reorder confirm dialog. Built on the shared Modal.
export function ConfirmSheet({
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmSheetProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      role="alertdialog"
      footer={
        <>
          <CapsuleButton
            variant={destructive ? "destructive" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </CapsuleButton>
          <CapsuleButton variant="secondary" size="md" onClick={onCancel}>
            {cancelLabel}
          </CapsuleButton>
        </>
      }
    >
      {description ? <p className="m-0 text-center text-[15px] leading-[1.4] text-label-2">{description}</p> : null}
    </Modal>
  );
}
