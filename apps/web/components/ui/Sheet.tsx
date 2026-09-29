import type { ReactNode } from "react";
import { Modal } from "./Modal";

type SheetProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
};

// A form/list modal: the shared Modal with a close button and optional
// confirm action in the header (docs/UI.md → Components: Modals).
export function Sheet({ title, subtitle, onClose, headerAction, children, className }: SheetProps) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} showClose headerAction={headerAction} className={className}>
      {children}
    </Modal>
  );
}
