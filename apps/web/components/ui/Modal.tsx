import { X } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";

type ModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  // Left-hand ✕ button; sheets show it, short alerts rely on their own buttons.
  showClose?: boolean;
  // Optional confirm action shown top-right (e.g. "Save").
  headerAction?: ReactNode;
  role?: "dialog" | "alertdialog";
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

// The one modal shell every dialog in the app is built on: centered, organic
// outline, same padding, title and backdrop (docs/UI.md → Components: Modals).
export function Modal({
  title,
  subtitle,
  onClose,
  showClose = false,
  headerAction,
  role = "dialog",
  children,
  footer,
  className,
}: ModalProps) {
  const hasSides = showClose || headerAction;
  return (
    <div className="fixed inset-0 z-[70]" role={role} aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
      <section
        className={clsx(
          "shape-modal sticker fixed inset-x-6 top-1/2 mx-auto flex max-h-[calc(100%-48px)] max-w-[380px] -translate-y-1/2 flex-col gap-4 overflow-y-auto bg-sheet p-5",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {hasSides ? (
            showClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center shape-sq bg-fill text-label"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            ) : (
              <span className="h-11 w-11" aria-hidden="true" />
            )
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <h2 id="modal-title" className="m-0 text-[20px] font-semibold leading-tight">
              {title}
            </h2>
            {subtitle ? <span className="text-[15px] text-label-2">{subtitle}</span> : null}
          </div>
          {hasSides ? headerAction ?? <span className="h-11 w-11" aria-hidden="true" /> : null}
        </div>
        {children}
        {footer ? <div className="flex flex-col gap-2.5">{footer}</div> : null}
      </section>
    </div>
  );
}
