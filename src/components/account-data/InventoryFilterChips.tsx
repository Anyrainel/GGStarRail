import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InventoryFilterChip {
  value: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}

interface InventoryFilterChipsProps {
  label: string;
  chips: readonly InventoryFilterChip[];
  className?: string;
}

export function InventoryFilterChips({
  label,
  chips,
  className,
}: InventoryFilterChipsProps) {
  return (
    <fieldset className={cn("min-w-0 space-y-1.5", className)}>
      <legend className="text-xs font-medium text-muted-foreground">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Button
            key={chip.value}
            type="button"
            size="sm"
            variant={chip.active ? "secondary" : "outline"}
            className={cn(
              "h-7 rounded-full px-3",
              chip.active && "border border-primary/35 text-foreground"
            )}
            aria-pressed={chip.active}
            onClick={chip.onToggle}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
