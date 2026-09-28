import clsx from "clsx";

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

// A centered iOS-style alert, for confirmations that name the customer
// (docs/UI.md → Design principles) and the reorder confirm dialog.
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
    <div className="fixed inset-0 z-50" role="alertdialog" aria-modal="true" aria-labelledby="confirm-sheet-title">
      <div className="absolute inset-0 bg-dim" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-x-8 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-[20px] bg-sheet shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col items-center gap-1.5 px-5 pb-4 pt-5 text-center">
          <span id="confirm-sheet-title" className="text-[17px] font-semibold text-label">
            {title}
          </span>
          {description ? <span className="text-[13px] leading-[1.4] text-label-2">{description}</span> : null}
        </div>
        <div className="h-px bg-separator" />
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 cursor-pointer border-r border-separator bg-transparent text-[17px] font-normal text-link"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={clsx(
              "h-11 cursor-pointer bg-transparent text-[17px] font-semibold disabled:cursor-default disabled:opacity-50",
              destructive ? "text-danger" : "text-link",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
