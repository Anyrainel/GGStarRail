import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name when no visible label references the switch. */
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-labelledby"?: string;
}

/** An on/off switch built on a native button with `role="switch"`. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
  disabled = false,
  className,
  "aria-labelledby": labelledBy,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-primary bg-primary" : "border-border bg-muted",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-xs transition-transform",
          checked ? "translate-x-4" : "translate-x-px"
        )}
      />
    </button>
  );
}
