import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { FilterChip } from "@/components/shared/FilterChip";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { cn } from "@/lib/utils";
import type { RelicKind } from "@/services/catalog/relicPresentation";

export interface RelicSetFilterOption {
  setId: string;
  name: string;
  iconPath: string;
  count: number;
}

export interface RelicSetFilterRow {
  kind: RelicKind;
  sets: readonly RelicSetFilterOption[];
}

/**
 * A collapsible multi-select set filter with one row of Cavern Relic sets and
 * one of Planar Ornament sets. Collapsed, it keeps only the chosen sets in view.
 * An empty selection means every set.
 */
export function RelicSetFilterGroup({
  label,
  rows,
  value,
  onChange,
}: {
  label: string;
  rows: readonly RelicSetFilterRow[];
  value: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = (setId: string) => {
    const next = new Set(value);
    if (next.has(setId)) next.delete(setId);
    else next.add(setId);
    onChange(next);
  };
  const chip = (set: RelicSetFilterOption) => (
    <FilterChip
      key={set.setId}
      active={value.size === 0 || value.has(set.setId)}
      onClick={() => toggle(set.setId)}
      count={set.count}
      icon={
        <AssetImage
          kind="relic-set"
          id={set.setId}
          sourcePath={set.iconPath}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-4 w-4 shrink-0 object-contain"
        />
      }
    >
      <span className="whitespace-nowrap">{set.name}</span>
    </FilterChip>
  );
  const selected = rows.flatMap((row) =>
    row.sets.filter((set) => value.has(set.setId))
  );

  return (
    <div className="space-y-1.5" data-relic-set-filter>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/30 px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-background/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
          {value.size > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {value.size}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
        {!expanded && selected.map(chip)}
      </div>
      {expanded && (
        // From md the toolbar is pinned above the results, so the open rows
        // scroll inside a capped area instead of pushing the results down.
        <div className="space-y-1.5 md:-m-0.5 md:max-h-[10.5rem] md:overflow-y-auto md:p-0.5">
          {rows
            .filter((row) => row.sets.length > 0)
            .map((row) => (
              <div
                key={row.kind}
                className="flex flex-wrap items-center gap-1"
                data-relic-set-row={row.kind}
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
                  <RelicKindIcon kind={row.kind} />
                </span>
                {row.sets.map(chip)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
