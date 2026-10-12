import { type InputHTMLAttributes, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CompactNumberInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "min" | "max" | "type"
  > {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

/**
 * A narrow numeric field for toolbars and popovers. In-range values apply
 * while typing; anything else is clamped, or reverted when empty, on blur.
 */
export function CompactNumberInput({
  value,
  min,
  max,
  onCommit,
  className,
  onBlur,
  onKeyDown,
  ...props
}: CompactNumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function parse(text: string): number | null {
    if (text.trim() === "") return null;
    const next = Number(text);
    return Number.isFinite(next) ? next : null;
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      value={draft}
      className={cn(
        "h-7 w-12 rounded-md border border-input bg-background px-1 text-center text-xs tabular-nums text-foreground outline-none transition-colors [appearance:textfield] focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = parse(event.target.value);
        if (next !== null && next >= min && next <= max && next !== value) {
          onCommit(next);
        }
      }}
      onBlur={(event) => {
        onBlur?.(event);
        const next = parse(draft);
        if (next === null) {
          setDraft(String(value));
          return;
        }
        const clamped = Math.min(max, Math.max(min, next));
        setDraft(String(clamped));
        if (clamped !== value) onCommit(clamped);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      {...props}
    />
  );
}
