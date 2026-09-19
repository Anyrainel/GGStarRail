import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function FilterChip({
  active,
  onClick,
  children,
  className,
  disabled = false,
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
        className
      )}
    >
      {children}
    </button>
  );
}
