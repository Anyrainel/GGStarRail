import { Check, Plus, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { CatalogHoverCard } from "./CatalogHoverCard";
import { ItemIcon, type ItemIconProps, type ItemIconSize } from "./ItemIcon";

export interface PickerItem {
  id: string;
  name: string;
  searchText: string;
  iconPath: string;
  rarity: number | null;
  cornerAsset?: ItemIconProps["cornerAsset"];
  tags?: readonly string[];
}

export interface PickerFilter {
  id: string;
  label: string;
  options: readonly { id: string; label: string }[];
}

interface ItemPickerProps {
  kind: "character" | "light-cone" | "relic-set";
  items: readonly PickerItem[];
  filters?: readonly PickerFilter[];
  value: string | null;
  label: string;
  onChange: (id: string) => void;
  onClear?: () => void;
  triggerSize?: ItemIconSize;
  showName?: boolean;
  badge?: number;
  compact?: boolean;
  disabled?: boolean;
}

/** All catalog pickers share search, filters, selection, and responsive behavior. */
export function ItemPicker({
  kind,
  items,
  filters = [],
  value,
  label,
  onChange,
  onClear,
  triggerSize = "lg",
  showName = false,
  badge,
  compact = false,
  disabled = false,
}: ItemPickerProps) {
  const { t } = useI18n();
  const mobile = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [preview, setPreview] = useState<string | null>(null);
  const headingId = useId();
  const selected = items.find((item) => item.id === value);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter(
      (item) =>
        (!needle ||
          `${item.name} ${item.searchText}`
            .toLocaleLowerCase()
            .includes(needle)) &&
        Object.values(activeFilters).every(
          (values) =>
            !values.length || values.some((tag) => item.tags?.includes(tag))
        )
    );
  }, [items, query, activeFilters]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveFilters({});
      setPreview(null);
    }
  }

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label={selected ? `${label}: ${selected.name}` : label}
      title={selected?.name ?? label}
      data-item-picker={kind}
      className={cn(
        "relative flex shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-gradient-select text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        showName && "pb-1",
        compact && !selected && "h-8 w-8 justify-center"
      )}
    >
      {selected ? (
        <CatalogHoverCard kind={kind} id={selected.id} disabled={open}>
          <ItemIcon
            kind={kind}
            id={selected.id}
            sourcePath={selected.iconPath}
            rarity={selected.rarity}
            cornerAsset={selected.cornerAsset}
            badge={badge}
            size={triggerSize}
            alt=""
            aria-hidden="true"
          />
        </CatalogHoverCard>
      ) : (
        <span
          className={cn(
            "flex items-center justify-center",
            !compact &&
              (triggerSize === "sm"
                ? "h-12 w-12"
                : triggerSize === "md"
                  ? "h-14 w-14"
                  : "h-16 w-16")
          )}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      {showName && selected && (
        <span
          className={cn(
            "line-clamp-2 text-center text-[0.65rem] font-medium leading-tight text-foreground",
            triggerSize === "sm" ? "w-12" : "w-16"
          )}
        >
          {selected.name}
        </span>
      )}
    </button>
  );
  const content = (
    <>
      <div className="shrink-0 space-y-3 border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPreview(null);
            }}
            aria-label={`${t("common.search")}: ${label}`}
            placeholder={t("common.search")}
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {filters.map((filter) => (
          <fieldset
            key={filter.id}
            aria-label={filter.label}
            className="flex flex-wrap gap-1"
          >
            {filter.options.map((option) => {
              const active =
                activeFilters[filter.id]?.includes(option.id) ?? false;
              return (
                <button
                  type="button"
                  key={option.id}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border border-border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/20 text-primary"
                      : "bg-background text-muted-foreground"
                  )}
                  onClick={() =>
                    setActiveFilters((current) => ({
                      ...current,
                      [filter.id]: active
                        ? (current[filter.id] ?? []).filter(
                            (id) => id !== option.id
                          )
                        : [...(current[filter.id] ?? []), option.id],
                    }))
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        data-picker-results
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] content-start gap-1">
          {visible.map((item) => (
            <CatalogHoverCard kind={kind} id={item.id} key={item.id}>
              <button
                type="button"
                aria-label={item.name}
                aria-pressed={item.id === value}
                onMouseEnter={() => setPreview(item.name)}
                onFocus={() => setPreview(item.name)}
                onClick={() => {
                  onChange(item.id);
                  changeOpen(false);
                }}
                className={cn(
                  "relative flex min-w-0 flex-col items-center gap-1 rounded-lg p-1.5 text-center outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  item.id === value &&
                    "bg-primary/20 ring-1 ring-inset ring-primary"
                )}
              >
                <ItemIcon
                  kind={kind}
                  id={item.id}
                  sourcePath={item.iconPath}
                  rarity={item.rarity}
                  cornerAsset={item.cornerAsset}
                  size="md"
                  alt=""
                  aria-hidden="true"
                />
                {item.id === value && (
                  <Check
                    className="absolute right-1 top-1 h-4 w-4 rounded-full bg-primary text-primary-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="line-clamp-2 min-h-7 w-full text-[0.65rem] leading-tight">
                  {item.name}
                </span>
              </button>
            </CatalogHoverCard>
          ))}
        </div>
        {!visible.length && (
          <p
            role="status"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            {t("empty.filtered")}
          </p>
        )}
      </div>
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {preview ?? selected?.name ?? label}
        </span>
        {onClear && value && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              onClear();
              changeOpen(false);
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t("common.clear")}
          </Button>
        )}
      </div>
    </>
  );

  if (mobile)
    return (
      <ResponsiveDialog open={open} onOpenChange={changeOpen}>
        <ResponsiveDialogTrigger asChild>{trigger}</ResponsiveDialogTrigger>
        <ResponsiveDialogContent
          closeLabel={t("common.close")}
          aria-describedby={undefined}
          className="flex h-[85dvh] max-h-[85dvh] flex-col overflow-hidden p-0"
        >
          <ResponsiveDialogHeader className="px-3 pt-4">
            <ResponsiveDialogTitle>{label}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {content}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        collisionPadding={10}
        aria-labelledby={headingId}
        className="flex h-[40rem] max-h-[min(80dvh,var(--radix-popover-content-available-height))] w-[30rem] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden bg-background p-0"
      >
        <h3 id={headingId} className="shrink-0 px-3 pt-3 text-sm font-semibold">
          {label}
        </h3>
        {content}
      </PopoverContent>
    </Popover>
  );
}
