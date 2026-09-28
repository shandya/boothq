import clsx from "clsx";

type TicketNumberProps = {
  number: number;
  size?: "hero" | "lg" | "md";
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<TicketNumberProps["size"]>, string> = {
  hero: "text-[96px]",
  lg: "text-[64px]",
  md: "text-[22px]",
};

// Ticket numbers are the hero element everywhere (docs/UI.md → Big numbers).
export function TicketNumber({ number, size = "md", className }: TicketNumberProps) {
  return (
    <span className={clsx("font-bold leading-none tracking-[-0.045em] tabular-nums", SIZE_CLASSES[size], className)}>
      #{number}
    </span>
  );
}
