import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export function GroupedList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex flex-col overflow-hidden rounded-[24px] bg-card", className)}>{children}</div>;
}

export function GroupedSeparator({ inset = 16 }: { inset?: number }) {
  return <div className="h-px bg-separator" style={{ marginLeft: inset }} />;
}

type CommonRowProps = {
  children: ReactNode;
  minHeight?: number;
  className?: string;
};

type GroupedRowButtonProps = CommonRowProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type GroupedRowAnchorProps = CommonRowProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function GroupedRow(props: GroupedRowButtonProps | GroupedRowAnchorProps) {
  const { children, minHeight = 52, className, ...rest } = props;
  const rowClass = clsx(
    "flex w-full items-center gap-3 px-4 text-left text-[17px] font-normal text-label",
    className,
  );

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...anchorProps } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return (
      <a href={href} className={rowClass} style={{ minHeight }} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type="button"
      className={clsx(rowClass, "cursor-pointer bg-transparent disabled:cursor-default disabled:opacity-50")}
      style={{ minHeight }}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
