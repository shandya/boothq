import { TicketNumber } from "../ui/TicketNumber";

type CalledTakeoverProps = {
  number: number;
  onDismiss: () => void;
};

// Solid --pop with --on-pop text in both schemes — the one color
// exception in the app (docs/UI.md → Color exceptions). Re-mounted by the
// parent whenever calledAt changes (recall), even after being dismissed.
export function CalledTakeover({ number, onDismiss }: CalledTakeoverProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-pop px-6 text-center text-on-pop">
      <TicketNumber number={number} size="hero" className="text-on-pop" />
      <span className="text-[26px] font-bold">It&apos;s your turn!</span>
      <span className="text-[17px]">Please come to the booth now.</span>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-8 h-12 cursor-pointer rounded-full bg-white/20 px-7 text-[15px] font-semibold text-on-accent"
      >
        OK
      </button>
    </div>
  );
}
