import type { ReactNode } from "react";

type BannerProps = {
  icon?: ReactNode;
  lines: string[];
};

// A soft orange attention banner: heads-up, "it's your turn" (after the
// takeover is dismissed), and the on-break notice all share this shape
// (docs/UI.md → Customer: /t/[token]).
export function Banner({ icon, lines }: BannerProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-[20px] bg-status-orange-bg px-4 py-3 text-status-orange-fg"
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
