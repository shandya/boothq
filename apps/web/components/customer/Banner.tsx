import clsx from "clsx";
import type { ReactNode } from "react";

type BannerProps = {
  icon?: ReactNode;
  lines: string[];
  tone?: "attention" | "info"; // orange (default) or blue
};

// A soft orange attention banner: heads-up, "it's your turn" (after the
// takeover is dismissed), and the on-break notice all share this shape
// (docs/UI.md → Customer: /t/[token]).
export function Banner({ icon, lines, tone = "attention" }: BannerProps) {
  return (
    <div
      role="status"
      className={clsx(
        "flex items-start gap-2.5 shape-tile px-4 py-3",
        tone === "info" ? "bg-status-blue-bg text-status-blue-fg" : "bg-status-orange-bg text-status-orange-fg",
      )}
    >
      {icon}
      <div className="flex flex-col gap-0.5 text-[14px] font-medium leading-[1.35]">
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
}
