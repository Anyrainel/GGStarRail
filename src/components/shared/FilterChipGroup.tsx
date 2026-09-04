import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilterChip } from "./FilterChip";

interface FilterChipGroupProps<T> {
  options: readonly T[];
  selectedValues: ReadonlySet<T>;
  onSelectedValuesChange: (nextValues: Set<T>) => void;
  getKey: (option: T) => string;
  getLabel: (option: T, active: boolean) => ReactNode;
  getIcon?: (option: T, active: boolean) => ReactNode;
  getValue?: (option: T) => T;
  label?: ReactNode;
  className?: string;
  emptyMeansAll?: boolean;
  collapsible?: boolean;
  disabled?: boolean;
}

export function FilterChipGroup<T>({
  options,
  selectedValues,
  onSelectedValuesChange,
  getKey,
  getLabel,
  getIcon,
  getValue = (option) => option,
  label,
  className,
  emptyMeansAll = true,
  collapsible = false,
  disabled = false,
}: FilterChipGroupProps<T>) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(
    (value: T) => {
      const nextValues = new Set(selectedValues);
      if (nextValues.has(value)) nextValues.delete(value);
      else nextValues.add(value);
      onSelectedValuesChange(nextValues);
    },
    [onSelectedValuesChange, selectedValues]
  );

  const showAllOptions = !collapsible || expanded;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {label &&
        (collapsible ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={expanded}
            disabled={disabled}
            onClick={() => setExpanded((value) => !value)}
            className="h-7 shrink-0 gap-1.5 rounded-full px-3"
          >
            {label}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-180"
              )}
              aria-hidden="true"
            />
          </Button>
        ) : (
          <span className="shrink-0 text-sm font-medium text-foreground">
            {label}:
          </span>
        ))}
      {options.map((option) => {
        const value = getValue(option);
        const explicitlySelected = selectedValues.has(value);
        if (!showAllOptions && !explicitlySelected) return null;

        const active =
          (emptyMeansAll && selectedValues.size === 0) || explicitlySelected;

        return (
          <FilterChip
            key={getKey(option)}
            active={active}
            onClick={() => handleToggle(value)}
            disabled={disabled}
          >
            {getIcon?.(option, active)}
            {getLabel(option, active)}
          </FilterChip>
        );
      })}
    </div>
  );
}
