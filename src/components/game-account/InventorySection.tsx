import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchInput } from "@/components/shared/SearchInput";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

interface InventorySectionProps {
  id: string;
  title: string;
  count: number;
  defaultExpanded?: boolean;
  /** A right-aligned section action, such as syncing from the game. */
  action?: ReactNode;
  children: ReactNode;
}

/** A collapsible inventory group with an unboxed GGArtifact-style header. */
export function InventorySection({
  id,
  title,
  count,
  defaultExpanded = true,
  action,
  children,
}: InventorySectionProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = `${id}-content`;
  const titleId = `${id}-title`;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <section className="space-y-3" aria-labelledby={titleId}>
      <div className="flex min-h-9 items-center gap-3 px-2">
        <h2 className="min-w-0 text-lg font-semibold">
          <button
            type="button"
            className="flex min-w-0 items-start gap-1.5 rounded-md text-left text-foreground/90 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-controls={contentId}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <Chevron
              className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span id={titleId}>{title}</span>{" "}
              <span className="ml-1 whitespace-nowrap text-base font-normal tabular-nums text-muted-foreground">
                {t("inventory.count", { count })}
              </span>
            </span>
          </button>
        </h2>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      {expanded && (
        <div id={contentId} className="space-y-3">
          {children}
        </div>
      )}
    </section>
  );
}

/** The filtered-empty line of an inventory group, with a reset link. */
export function InventoryFilteredEmpty({
  icon,
  onClear,
}: {
  icon: LucideIcon;
  onClear: () => void;
}) {
  const { t } = useI18n();
  return (
    <EmptyState variant="inline" messageKey="empty.filtered" icon={icon}>
      <button
        type="button"
        className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onClear}
      >
        {t("filter.clearAll")}
      </button>
    </EmptyState>
  );
}

/** One wrapping row of inventory filter chips. */
export function InventoryChipRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 px-2", className)}>
      {children}
    </div>
  );
}

/** A flex spacer between chip groups in one wrapping row. */
export function ChipGroupGap() {
  return <span className="mx-0.5" aria-hidden="true" />;
}

/**
 * The compact search at the end of an inventory chip row. A zero-basis spacer
 * keeps it right-aligned while it fits; once it wraps, it starts the new line.
 */
export function InventorySearch({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}) {
  const { t } = useI18n();
  return (
    <>
      <span className="hidden flex-1 sm:block" aria-hidden="true" />
      <SearchInput
        variant="sidebar"
        label={t("common.search")}
        placeholder={placeholder}
        value={value}
        onValueChange={onValueChange}
        wrapperClassName="w-full sm:w-60"
      />
    </>
  );
}

/** Returns a copy of the set with the value toggled. */
export function toggled<T>(values: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
