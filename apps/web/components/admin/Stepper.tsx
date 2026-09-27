import { Minus, Plus } from "lucide-react";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  "aria-label"?: string;
};

export function Stepper({ value, onChange, min = 0, max = 10, ...rest }: StepperProps) {
  return (
    <div className="flex items-center gap-4" {...rest}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-fill text-label disabled:cursor-default disabled:opacity-30"
      >
        <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>
      <span className="w-6 text-center text-[17px] tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-fill text-label disabled:cursor-default disabled:opacity-30"
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
