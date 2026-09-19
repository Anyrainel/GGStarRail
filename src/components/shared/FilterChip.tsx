import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  color?: "rarity-5" | "rarity-4" | "rarity-3";
}

const CHIP_COLORS = {
  "rarity-5": {
    active: "bg-amber-500/25 border-amber-500/50 text-amber-400",
    inactive:
      "bg-amber-500/10 border-amber-500/30 text-amber-400/60 hover:text-amber-400",
  },
  "rarity-4": {
    active: "bg-purple-500/25 border-purple-500/50 text-purple-400",
    inactive:
      "bg-purple-500/10 border-purple-500/30 text-purple-400/60 hover:text-purple-400",
  },
  "rarity-3": {
    active: "bg-blue-500/25 border-blue-500/50 text-blue-400",
    inactive:
      "bg-blue-500/10 border-blue-500/30 text-blue-400/60 hover:text-blue-400",
  },
} as const;

export function FilterChip({
  active,
  onClick,
  children,
  className,
  disabled = false,
  color,
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-primary/40 bg-card text-foreground shadow-sm"
          : "border-border bg-transparent text-muted-foreground hover:bg-card hover:text-foreground",
        color && CHIP_COLORS[color][active ? "active" : "inactive"],
        className
      )}
    >
      {children}
    </button>
  );
}
