import type { ReactNode } from "react";
import { SearchInput } from "@/components/shared/SearchInput";
import { useBetaSearch } from "@/hooks/useBetaSearch";
import { isArchiveSearchActive } from "@/lib/search/archiveFilters";

interface ArchiveToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  filtersLabel?: string;
  /** A centred row above the search, such as catalog tabs. */
  tabs?: ReactNode;
  /** Chip groups (`className="contents"`) separated by `ArchiveChipDivider`. */
  children?: ReactNode;
}

export function ArchiveToolbar({
  searchQuery,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  filtersLabel,
  tabs,
  children,
}: ArchiveToolbarProps) {
  const filtersDisabled = isArchiveSearchActive(searchQuery);
  const { changeSearch, error } = useBetaSearch(onSearchChange);

  return (
    <div className="space-y-3">
      {tabs && <div className="flex justify-center">{tabs}</div>}
      <div>
        <SearchInput
          variant="prominent"
          value={searchQuery}
          onValueChange={changeSearch}
          label={searchLabel}
          placeholder={searchPlaceholder}
          className="text-ellipsis"
        />
        {error && (
          <p
            role="alert"
            className="mx-auto mt-1 max-w-2xl px-1 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>

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

/** The thin rule between chip groups; chips wrap without it on phones. */
export function ArchiveChipDivider() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 hidden h-5 w-px bg-border sm:block"
    />
  );
}
