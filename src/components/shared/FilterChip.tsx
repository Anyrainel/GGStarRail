import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "outline"}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 rounded-full px-3",
        active && "border border-primary/35 text-foreground",
        className
      )}
    >
      {children}
    </Button>
  );
}
