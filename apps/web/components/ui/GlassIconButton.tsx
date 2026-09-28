import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type GlassIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  icon: ReactNode;
  "aria-label": string;
  className?: string;
};

export function GlassIconButton({ icon, className, ...rest }: GlassIconButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        "glass flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-label disabled:cursor-default disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
