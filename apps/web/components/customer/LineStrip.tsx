import clsx from "clsx";

type LineStripProps = {
  currentNumber: number | null;
  aheadNumbers: number[]; // first 2 WAITING tickets ahead, in position order
  waitingAhead: number; // total WAITING tickets ahead (may exceed aheadNumbers.length)
  ownNumber: number;
};

type Circle = { key: string; label: string | undefined; content: string; mine?: boolean };

// One circle per ticket from the one being drawn up to the customer's own;
// collapses whatever aheadNumbers didn't cover into a single "+N" circle
// (docs/UI.md → Customer: /t/[token], Line strip).
export function LineStrip({ currentNumber, aheadNumbers, waitingAhead, ownNumber }: LineStripProps) {
  const circles: Circle[] = [];

  if (currentNumber != null) {
    circles.push({ key: "current", label: "Drawing", content: String(currentNumber) });
  }
  aheadNumbers.forEach((n, i) => {
    circles.push({ key: `ahead-${n}`, label: i === 0 ? "Next" : undefined, content: String(n) });
  });
  const hidden = waitingAhead - aheadNumbers.length;
  if (hidden > 0) {
    circles.push({ key: "more", label: undefined, content: `+${hidden}` });
  }
  circles.push({ key: "you", label: "You", content: String(ownNumber), mine: true });

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2">
        {circles.map((c) => (
          <span
            key={c.key}
            className={clsx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold tabular-nums",
              c.mine ? "border-2 border-accent text-accent" : "bg-fill text-label",
            )}
          >
            {c.content}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {circles.map((c) => (
          <span key={c.key} className="w-11 text-center text-[11px] font-medium text-label-2">
            {c.label ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}
