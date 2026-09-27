import { X } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { GlassIconButton } from "./GlassIconButton";

type SheetProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
};

// Floats 8px in from the screen edges, 38px corner radius, a glass close
// button on the left and an optional confirm action on the right
// (docs/UI.md → Components: Sheets).
export function Sheet({ title, subtitle, onClose, headerAction, children, className }: SheetProps) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
      <section
        className={clsx(
          "fixed inset-x-2 bottom-2 flex max-h-[calc(100%-16px)] flex-col gap-4 overflow-y-auto rounded-[38px] bg-sheet px-4 pb-[22px] pt-3.5 shadow-[0_-4px_40px_rgba(0,0,0,0.25)]",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <GlassIconButton icon={<X className="h-5 w-5" strokeWidth={2} />} onClick={onClose} aria-label="Close" />
          <div className="flex flex-col items-center">
            <h2 id="sheet-title" className="m-0 text-[17px] font-semibold">
              {title}
            </h2>
            {subtitle ? <span className="text-[13px] text-label-2">{subtitle}</span> : null}
          </div>
          {headerAction ?? <span className="h-11 w-11" aria-hidden="true" />}
        </div>
        {children}
      </section>
    </div>
  );
}
