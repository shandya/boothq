import clsx from "clsx";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({ checked, onChange, disabled, className, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-[31px] w-[51px] shrink-0 cursor-pointer shape-sq transition-colors disabled:cursor-default disabled:opacity-50",
        checked ? "bg-switch-on" : "bg-track",
        className,
      )}
      {...rest}
    >
      <span
        className="absolute left-0 top-[2px] h-[27px] w-[27px] shape-sq bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-transform"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}
