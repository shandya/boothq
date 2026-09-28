import type { ReactNode } from "react";
import clsx from "clsx";

export function GlassBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("glass flex items-center gap-1.5 rounded-full p-1.5", className)}>{children}</div>;
}
