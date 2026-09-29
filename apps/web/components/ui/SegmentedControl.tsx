import clsx from "clsx";

export type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={clsx("grid gap-0.5 shape-sq bg-fill p-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              "h-10 cursor-pointer shape-sq text-[15px]",
              selected
                ? "bg-card font-semibold text-label shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                : "bg-transparent font-medium text-label",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
