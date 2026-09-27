import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "destructive";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white",
  secondary: "bg-fill text-link",
  destructive: "bg-fill text-danger",
};

type CapsuleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  children: ReactNode;
  variant?: Variant;
  size?: "lg" | "md";
  pending?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function CapsuleButton({
  children,
  variant = "primary",
  size = "lg",
  pending = false,
  icon,
  disabled,
  className,
  ...rest
}: CapsuleButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || pending}
      className={clsx(
        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[17px] font-semibold transition-opacity disabled:cursor-default disabled:opacity-50",
        size === "lg" ? "h-14" : "h-[52px]",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {pending ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-[18px] w-[18px] animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
