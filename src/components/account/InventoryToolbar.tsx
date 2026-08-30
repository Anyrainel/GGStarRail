import { Search } from "lucide-react";

export interface InventoryFilterOption {
  value: string;
  label: string;
}

export interface InventoryFilter {
  id: string;
  label: string;
  value: string;
  options: readonly InventoryFilterOption[];
  onChange: (value: string) => void;
}

interface InventoryToolbarProps {
  query: string;
  searchLabel: string;
  searchPlaceholder: string;
  countLabel: string;
  filters?: readonly InventoryFilter[];
  onQueryChange: (value: string) => void;
}

export function InventoryToolbar({
  query,
  searchLabel,
  searchPlaceholder,
  countLabel,
  filters = [],
  onQueryChange,
}: InventoryToolbarProps) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card/70 p-4 lg:grid-cols-[minmax(14rem,1fr)_auto]">
      <label className="relative block">
        <span className="sr-only">{searchLabel}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-border bg-background/80 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        {filters.map((filter) => (
          <label key={filter.id} className="grid min-w-32 gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {filter.label}
            </span>
            <select
              value={filter.value}
              onChange={(event) => filter.onChange(event.currentTarget.value)}
              className="h-10 rounded-lg border border-border bg-background/80 px-3 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <p className="ml-auto pb-2 text-sm tabular-nums text-muted-foreground">
          {countLabel}
        </p>
      </div>
    </section>
  );
}
