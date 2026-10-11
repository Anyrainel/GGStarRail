import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
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
  getColor?: (option: T) => "rarity-5" | "rarity-4" | "rarity-3" | undefined;
  /** Matching records per option, shown after its label. */
  getCount?: (option: T) => number | undefined;
  /** Accessible name and tooltip, for icon-only chips. */
  getTitle?: (option: T) => string | undefined;
  label?: ReactNode;
  className?: string;
  emptyMeansAll?: boolean;
  /** One value at a time; clicking the active chip again returns to all. */
  singleSelect?: boolean;
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
  getColor,
  getCount,
  getTitle,
  label,
  className,
  emptyMeansAll = true,
  singleSelect = false,
  collapsible = false,
  disabled = false,
}: FilterChipGroupProps<T>) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(
    (value: T) => {
      if (singleSelect) {
        onSelectedValuesChange(
          selectedValues.has(value) && selectedValues.size === 1
            ? new Set()
            : new Set([value])
        );
        return;
      }
      const nextValues = new Set(selectedValues);
      if (nextValues.has(value)) nextValues.delete(value);
      else nextValues.add(value);
      onSelectedValuesChange(nextValues);
    },
    [onSelectedValuesChange, selectedValues, singleSelect]
  );

  const showAllOptions = !collapsible || expanded;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {label &&
        (collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            disabled={disabled}
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/30 px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-background/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {label}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
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
        const title = getTitle?.(option);

        return (
          <FilterChip
            color={getColor?.(option)}
            key={getKey(option)}
            active={active}
            onClick={() => handleToggle(value)}
            disabled={disabled}
            icon={getIcon?.(option, active)}
            count={getCount?.(option)}
            title={title}
            aria-label={title}
          >
            {getLabel(option, active)}
          </FilterChip>
        );
      })}
    </div>
  );
}
