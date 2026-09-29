import { Search } from "lucide-react";
import type { ChangeEvent } from "react";
import clsx from "clsx";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
};

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  label = "Search",
  className,
}: SearchFieldProps) {
  return (
    <label className={clsx("relative flex h-11 items-center gap-2 shape-sq bg-fill px-3.5 text-label-2", className)}>
      <Search className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="absolute h-px w-px overflow-hidden [clip-path:inset(50%)]">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
      />
    </label>
  );
}
