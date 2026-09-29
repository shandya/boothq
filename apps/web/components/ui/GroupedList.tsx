import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export function GroupedList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex flex-col overflow-hidden shape-card sticker bg-card", className)}>{children}</div>;
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

type GroupedRowDivProps = CommonRowProps & { href?: undefined; onClick?: undefined };

// Renders a <div> when it's just a layout row around its own interactive
// children (a Switch, a Stepper, an input) — only <button> or <a> when the
// whole row itself is the tap target, so we never nest interactive elements
// (invalid HTML: a <button> can't contain a <button>).
export function GroupedRow(props: GroupedRowButtonProps | GroupedRowAnchorProps | GroupedRowDivProps) {
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

  if ("onClick" in rest && rest.onClick !== undefined) {
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

  return (
    <div className={rowClass} style={{ minHeight }}>
      {children}
    </div>
  );
}
