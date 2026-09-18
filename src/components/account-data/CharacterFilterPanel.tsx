import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { AssetImage } from "@/components/shared/AssetImage";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

export interface CharacterFilterOption {
  value: string;
  label: string;
  iconPath?: string;
}

export interface CharacterFilters {
  query: string;
  paths: string[];
  combatTypes: string[];
  rarities: number[];
  ownedOnly: boolean;
  configuredOnly: boolean;
  sort: "name" | "rarity" | "level" | "priority";
  direction: "ascending" | "descending";
}

export function defaultCharacterFilters(): CharacterFilters {
  return {
    query: "",
    paths: [],
    combatTypes: [],
    rarities: [],
    ownedOnly: false,
    configuredOnly: false,
    sort: "rarity",
    direction: "descending",
  };
}

export function characterFilterCount(filters: CharacterFilters): number {
  return (
    Number(filters.query.trim().length > 0) +
    filters.paths.length +
    filters.combatTypes.length +
    filters.rarities.length +
    Number(filters.ownedOnly) +
    Number(filters.configuredOnly)
  );
}

interface CharacterFilterPanelProps {
  className?: string;
  filters: CharacterFilters;
  onChange: (filters: CharacterFilters) => void;
  pathOptions: readonly CharacterFilterOption[];
  combatTypeOptions: readonly CharacterFilterOption[];
  countLabel: string;
  searchPlaceholder: string;
  showOwnedOnly?: boolean;
  hasAccount?: boolean;
  showLevelSort?: boolean;
  hasPriorityData?: boolean;
}

export function CharacterFilterPanel({
  className,
  filters,
  onChange,
  pathOptions,
  combatTypeOptions,
  countLabel,
  searchPlaceholder,
  showOwnedOnly = false,
  hasAccount = false,
  showLevelSort = false,
  hasPriorityData = false,
}: CharacterFilterPanelProps) {
  const { t } = useI18n();
  const update = (patch: Partial<CharacterFilters>) =>
    onChange({ ...filters, ...patch });
  const toggle = <T,>(values: T[], value: T) =>
    values.includes(value)
      ? values.filter((entry) => entry !== value)
      : [...values, value];
  const optionGroup = (
    label: string,
    kind: "path" | "combat-type",
    options: readonly CharacterFilterOption[],
    selected: string[],
    onSelected: (values: string[]) => void
  ) => (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground xl:text-base">
        {label}
      </legend>
      {selected.length > 0 && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-5 rounded-full px-2.5 text-xs"
          onClick={() => onSelected([])}
        >
          {t("common.clear")}
        </Button>
      )}
      <div
        className={cn(
          "grid gap-x-2 gap-y-2",
          kind === "path" ? "grid-cols-1" : "grid-cols-2"
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-w-0 cursor-pointer items-center gap-1.5 text-sm text-foreground"
          >
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-primary"
              checked={selected.includes(option.value)}
              onChange={() => onSelected(toggle(selected, option.value))}
            />
            <AssetImage
              kind={kind}
              id={option.value}
              sourcePath={option.iconPath}
              alt=""
              className="h-5 w-5 shrink-0 object-contain"
            />
            <span className="min-w-0 break-words leading-tight">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const sortOptions: { value: CharacterFilters["sort"]; label: string }[] = [
    { value: "priority", label: t("filter.sortPriority") },
    { value: "name", label: t("filter.sortName") },
    { value: "rarity", label: t("filter.sortRarity") },
    ...(showLevelSort
      ? [{ value: "level" as const, label: t("filter.sortLevel") }]
      : []),
  ];

  return (
    <aside
      aria-label={t("characterLoadout.filters")}
      className={cn(
        "rounded-xl border border-border bg-card/50 p-4 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-9.5rem)] lg:overflow-y-auto lg:self-start xl:p-5",
        className
      )}
    >
      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label={t("common.search")}
          placeholder={searchPlaceholder}
          value={filters.query}
          onChange={(event) => update({ query: event.currentTarget.value })}
          className="h-9 w-full rounded-md border border-border bg-background/70 pl-8 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {filters.query && (
          <button
            type="button"
            aria-label={t("common.clear")}
            onClick={() => update({ query: "" })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-5">
        <section className="space-y-2">
          <h2 className="text-base font-semibold xl:text-lg">
            {t("filter.sort")}
          </h2>
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
            {sortOptions.map((option) => (
              <div key={option.value} className="contents">
                <span className="text-sm font-medium">{option.label}</span>
                <div className="flex rounded-md border border-border p-0.5">
                  {(["descending", "ascending"] as const).map((direction) => (
                    <Button
                      key={direction}
                      disabled={option.value === "priority" && !hasPriorityData}
                      type="button"
                      variant={
                        filters.sort === option.value &&
                        filters.direction === direction
                          ? "secondary"
                          : "ghost"
                      }
                      size="sm"
                      className="h-6 px-2"
                      aria-label={`${option.label}: ${direction === "ascending" ? t("filter.ascending") : t("filter.descending")}`}
                      aria-pressed={
                        filters.sort === option.value &&
                        filters.direction === direction
                      }
                      onClick={() => update({ sort: option.value, direction })}
                    >
                      {direction === "ascending" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!hasPriorityData && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("filter.priorityUnavailable")}
            </p>
          )}
        </section>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold xl:text-lg">
              {t("characterLoadout.filters")}
            </h2>
            {characterFilterCount(filters) > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 rounded-full px-3 text-xs"
                onClick={() =>
                  onChange({
                    ...defaultCharacterFilters(),
                    sort: filters.sort,
                    direction: filters.direction,
                  })
                }
              >
                {t("filter.reset")}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {showOwnedOnly && (
              <label
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  hasAccount ? "cursor-pointer" : "text-muted-foreground"
                )}
                title={hasAccount ? undefined : t("build.ownedOnlyUnavailable")}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={filters.ownedOnly}
                  disabled={!hasAccount}
                  onChange={(event) =>
                    update({ ownedOnly: event.currentTarget.checked })
                  }
                />
                {t("build.ownedOnly")}
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={filters.configuredOnly}
                onChange={(event) =>
                  update({ configuredOnly: event.currentTarget.checked })
                }
              />
              {t("filter.configuredOnly")}
            </label>
          </div>
          {optionGroup(
            t("filter.combatType"),
            "combat-type",
            combatTypeOptions,
            filters.combatTypes,
            (combatTypes) => update({ combatTypes })
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium xl:text-base">
              {t("filter.rarity")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {[4, 5].map((rarity) => (
                <label
                  key={rarity}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={filters.rarities.includes(rarity)}
                    onChange={() =>
                      update({ rarities: toggle(filters.rarities, rarity) })
                    }
                  />
                  <span>★ {rarity}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {optionGroup(
            t("filter.path"),
            "path",
            pathOptions,
            filters.paths,
            (paths) => update({ paths })
          )}
        </div>
        <p
          className="text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {countLabel}
        </p>
      </div>
    </aside>
  );
}
