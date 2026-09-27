import type { ReactNode } from "react";
import clsx from "clsx";

export function LargeTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={clsx("m-0 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-label", className)}
    >
      {children}
    </h1>
  );
}
