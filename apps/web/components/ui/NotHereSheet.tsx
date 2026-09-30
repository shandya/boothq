import { useT } from "../../lib/i18n";
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
  const t = useT();
  return (
    <Modal
      title={t("ui.notHere.title")}
      onClose={onCancel}
      footer={
        <>
          <CapsuleButton variant="primary" size="md" onClick={() => onRequeue(2)}>
            {t("ui.notHere.putBack")}
          </CapsuleButton>
          <CapsuleButton variant="destructive" size="md" onClick={onNoShow}>
            {t("ui.notHere.noShow")}
          </CapsuleButton>
          <CapsuleButton variant="secondary" size="md" onClick={onCancel}>
            {t("common.cancel")}
          </CapsuleButton>
        </>
      }
    />
  );
}
