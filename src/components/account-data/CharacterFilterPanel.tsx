import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CharacterFilterOption {
  value: string;
  label: string;
}

interface CharacterFilterPanelProps {
  className?: string;
  query: string;
  pathId: string;
  combatTypeId: string;
  pathOptions: readonly CharacterFilterOption[];
  combatTypeOptions: readonly CharacterFilterOption[];
  countLabel: string;
  labels: {
    filters: string;
    search: string;
    searchPlaceholder: string;
    path: string;
    combatType: string;
    clear: string;
  };
  onQueryChange: (value: string) => void;
  onPathChange: (value: string) => void;
  onCombatTypeChange: (value: string) => void;
  onClear: () => void;
}

export function CharacterFilterPanel({
  className,
  query,
  pathId,
  combatTypeId,
  pathOptions,
  combatTypeOptions,
  countLabel,
  labels,
  onQueryChange,
  onPathChange,
  onCombatTypeChange,
  onClear,
}: CharacterFilterPanelProps) {
  const hasActiveFilters =
    query.trim().length > 0 || pathId !== "all" || combatTypeId !== "all";

  return (
    <aside
      aria-label={labels.filters}
      className={cn(
        "rounded-xl border border-border bg-card/70 p-4 lg:sticky lg:top-4 lg:self-start",
        className
      )}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <label className="relative col-span-2 block lg:col-span-1">
          <span className="sr-only">{labels.search}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder={labels.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-border bg-background/80 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
          />
        </label>

        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {labels.path}
          </span>
          <select
            value={pathId}
            onChange={(event) => onPathChange(event.currentTarget.value)}
            className="h-10 min-w-0 w-full rounded-lg border border-border bg-background/80 px-3 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
          >
            {pathOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {labels.combatType}
          </span>
          <select
            value={combatTypeId}
            onChange={(event) => onCombatTypeChange(event.currentTarget.value)}
            className="h-10 min-w-0 w-full rounded-lg border border-border bg-background/80 px-3 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
          >
            {combatTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 lg:flex-col lg:items-stretch">
        <p className="text-xs tabular-nums text-muted-foreground">
          {countLabel}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="lg:w-full"
          onClick={onClear}
          disabled={!hasActiveFilters}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {labels.clear}
        </Button>
      </div>
    </aside>
  );
}
