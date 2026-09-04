import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { isArchiveSearchActive } from "@/lib/archiveFilters";

interface ArchiveToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  filtersLabel?: string;
  children?: ReactNode;
}

export function ArchiveToolbar({
  searchQuery,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  filtersLabel,
  children,
}: ArchiveToolbarProps) {
  const filtersDisabled = isArchiveSearchActive(searchQuery);

  return (
    <div className="space-y-3">
      <label className="relative mx-auto block max-w-2xl">
        <span className="sr-only">{searchLabel}</span>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-xl border border-border bg-card/50 pl-10 pr-3 text-base text-foreground outline-none shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
        />
      </label>

      {children && (
        <fieldset
          disabled={filtersDisabled}
          aria-label={filtersLabel}
          className="m-0 flex min-w-0 flex-wrap items-center justify-center gap-1.5 border-0 p-0"
        >
          {children}
        </fieldset>
      )}
    </div>
  );
}
