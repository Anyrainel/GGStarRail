import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  color?: "rarity-5" | "rarity-4" | "rarity-3";
  icon?: ReactNode;
  /** Matching records, shown after the label. */
  count?: number;
  title?: string;
  "aria-label"?: string;
}

const CHIP_COLORS = {
  "rarity-5": {
    active: "bg-rarity-5/25 border-rarity-5/50 text-rarity-5-foreground",
    inactive:
      "bg-rarity-5/10 border-rarity-5/30 text-rarity-5-foreground/60 hover:text-rarity-5-foreground",
  },
  "rarity-4": {
    active: "bg-rarity-4/25 border-rarity-4/50 text-rarity-4-foreground",
    inactive:
      "bg-rarity-4/10 border-rarity-4/30 text-rarity-4-foreground/60 hover:text-rarity-4-foreground",
  },
  "rarity-3": {
    active: "bg-rarity-3/25 border-rarity-3/50 text-rarity-3-foreground",
    inactive:
      "bg-rarity-3/10 border-rarity-3/30 text-rarity-3-foreground/60 hover:text-rarity-3-foreground",
  },
} as const;

export function FilterChip({
  active,
  onClick,
  children,
  className,
  disabled = false,
  color,
  icon,
  count,
  title,
  "aria-label": ariaLabel,
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-primary/40 bg-card text-foreground"
          : "border-border bg-transparent text-muted-foreground hover:bg-card hover:text-foreground",
        color && CHIP_COLORS[color][active ? "active" : "inactive"],
        className
      )}
    >
      {icon}
      {children}
      {count !== undefined && " "}
      {count !== undefined && (
        <span className="font-mono text-[11px] text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}
