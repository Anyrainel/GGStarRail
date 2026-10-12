import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CategoryChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  /** Show only the icon below `sm`; the label stays the accessible name. */
  iconOnlyBelowSm?: boolean;
  disabled?: boolean;
  className?: string;
}

/** An on/off category toggle with a check (on) or minus (off) mark. */
export function CategoryChip({
  active,
  onClick,
  label,
  icon,
  iconOnlyBelowSm = false,
  disabled = false,
  className,
}: CategoryChipProps) {
  const Mark = active ? Check : Minus;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={iconOnlyBelowSm && icon ? label : undefined}
      title={iconOnlyBelowSm && icon ? label : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium leading-none outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-primary/40 bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <Mark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {icon}
      <span className={cn(iconOnlyBelowSm && icon && "hidden sm:inline")}>
        {label}
      </span>
    </button>
  );
}
