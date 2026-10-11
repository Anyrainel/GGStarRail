import { type ReactNode, useId } from "react";
import {
  SidebarClearButton,
  SidebarPanel,
  SidebarSection,
} from "@/components/layout/SidebarPanel";
import { AssetImage } from "@/components/shared/AssetImage";
import { CheckboxRow } from "@/components/shared/Checkbox";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  SORT_TOGGLE_GRID_CLASS,
  type SortDirection,
  SortToggleGroup,
} from "@/components/shared/SortToggleGroup";
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
  sort: "release" | "level" | "priority";
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
    sort: "release",
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

/** Clears every filter while keeping the chosen sort. */
export function clearCharacterFilters(
  filters: CharacterFilters
): CharacterFilters {
  return {
    ...defaultCharacterFilters(),
    sort: filters.sort,
    direction: filters.direction,
  };
}

interface CharacterFilterPanelProps {
  className?: string;
  filters: CharacterFilters;
  onChange: (filters: CharacterFilters) => void;
  pathOptions: readonly CharacterFilterOption[];
  combatTypeOptions: readonly CharacterFilterOption[];
  /** Announced to assistive technology when the result count changes. */
  countLabel: string;
  searchPlaceholder: string;
  showOwnedOnly?: boolean;
  hasAccount?: boolean;
  showLevelSort?: boolean;
  hasPriorityData?: boolean;
}

const RARITIES = [5, 4] as const;

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

  const sortOptions: {
    value: CharacterFilters["sort"];
    label: string;
    disabled: boolean;
  }[] = [
    {
      value: "priority",
      label: t("filter.sortPriority"),
      disabled: !hasPriorityData,
    },
    {
      value: "release",
      label: t("filter.sortReleaseDate"),
      disabled: false,
    },
    ...(showLevelSort
      ? [
          {
            value: "level" as const,
            label: t("filter.sortLevel"),
            disabled: false,
          },
        ]
      : []),
  ];
  const sortValue = (sort: CharacterFilters["sort"]): SortDirection =>
    filters.sort !== sort
      ? "off"
      : filters.direction === "ascending"
        ? "asc"
        : "desc";
  const changeSort = (sort: CharacterFilters["sort"], value: SortDirection) => {
    if (value === "off") {
      // Release date is the fallback order, so turning a sort off returns to it.
      if (filters.sort === sort && sort !== "release") {
        update({ sort: "release", direction: "descending" });
      }
      return;
    }
    update({
      sort,
      direction: value === "asc" ? "ascending" : "descending",
    });
  };

  return (
    <SidebarPanel label={t("characterLoadout.filters")} className={className}>
      <SearchInput
        variant="sidebar"
        label={t("common.search")}
        placeholder={searchPlaceholder}
        value={filters.query}
        onValueChange={(query) => update({ query })}
      />

      <SidebarSection title={t("filter.sort")}>
        <div className={SORT_TOGGLE_GRID_CLASS}>
          {sortOptions.map((option) => (
            <div key={option.value} className="contents">
              <span
                className={cn(
                  "text-sm font-medium",
                  option.disabled ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {option.label}
              </span>
              <SortToggleGroup
                label={option.label}
                value={sortValue(option.value)}
                onChange={(value) => changeSort(option.value, value)}
                disabled={option.disabled}
                disabledReason={
                  option.value === "priority"
                    ? t("filter.priorityUnavailable")
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection
        title={t("common.filters")}
        action={
          characterFilterCount(filters) > 0 && (
            <SidebarClearButton
              label={t("filter.clearAll")}
              onClick={() => onChange(clearCharacterFilters(filters))}
            />
          )
        }
      >
        <div className="space-y-2">
          {showOwnedOnly && (
            <div
              title={hasAccount ? undefined : t("build.ownedOnlyUnavailable")}
            >
              <CheckboxRow
                label={t("build.ownedOnly")}
                className={cn("font-medium", FILTER_ROW_CLASS)}
                checked={filters.ownedOnly}
                disabled={!hasAccount}
                onCheckedChange={(ownedOnly) => update({ ownedOnly })}
              />
            </div>
          )}
          <CheckboxRow
            label={t("filter.configuredOnly")}
            className={cn("font-medium", FILTER_ROW_CLASS)}
            checked={filters.configuredOnly}
            onCheckedChange={(configuredOnly) => update({ configuredOnly })}
          />
        </div>
        <OptionGroup
          label={t("filter.combatType")}
          kind="combat-type"
          options={combatTypeOptions}
          selected={filters.combatTypes}
          onSelected={(combatTypes) => update({ combatTypes })}
        />
        <CheckboxGroup
          label={t("filter.rarity")}
          onClear={
            filters.rarities.length > 0
              ? () => update({ rarities: [] })
              : undefined
          }
        >
          {RARITIES.map((rarity) => (
            <CheckboxRow
              key={rarity}
              label={`★ ${rarity}`}
              className={FILTER_ROW_CLASS}
              checked={filters.rarities.includes(rarity)}
              onCheckedChange={() =>
                update({ rarities: toggleValue(filters.rarities, rarity) })
              }
            />
          ))}
        </CheckboxGroup>
        <OptionGroup
          label={t("filter.path")}
          kind="path"
          options={pathOptions}
          selected={filters.paths}
          onSelected={(paths) => update({ paths })}
        />
      </SidebarSection>
      <p className="sr-only" aria-live="polite">
        {countLabel}
      </p>
    </SidebarPanel>
  );
}

/** Every filter row shares one label size; two-column names need the smaller one. */
const FILTER_ROW_CLASS = "xl:text-sm";

function OptionGroup({
  label,
  kind,
  options,
  selected,
  onSelected,
}: {
  label: string;
  kind: "path" | "combat-type";
  options: readonly CharacterFilterOption[];
  selected: string[];
  onSelected: (values: string[]) => void;
}) {
  return (
    <CheckboxGroup
      label={label}
      // Path names are long, so Paths take the full sidebar width.
      columns={kind === "path" ? 1 : "sidebar"}
      onClear={selected.length > 0 ? () => onSelected([]) : undefined}
    >
      {options.map((option) => (
        <CheckboxRow
          key={option.value}
          label={<span title={option.label}>{option.label}</span>}
          className={FILTER_ROW_CLASS}
          icon={
            <AssetImage
              kind={kind}
              id={option.value}
              sourcePath={option.iconPath}
              alt=""
              className="object-contain"
            />
          }
          checked={selected.includes(option.value)}
          onCheckedChange={() =>
            onSelected(toggleValue(selected, option.value))
          }
        />
      ))}
    </CheckboxGroup>
  );
}

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function CheckboxGroup({
  label,
  columns = 2,
  onClear,
  children,
}: {
  label: string;
  /** `sidebar`: two columns unless the inline sidebar is at its narrow width. */
  columns?: 1 | 2 | "sidebar";
  onClear?: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const labelId = useId();
  return (
    <fieldset
      aria-labelledby={labelId}
      className="m-0 min-w-0 space-y-2 border-0 p-0"
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <span
          id={labelId}
          className="text-sm font-medium text-foreground xl:text-base"
        >
          {label}
        </span>
        {onClear && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-5 rounded-full px-2.5 text-xs"
            onClick={onClear}
          >
            {t("common.clear")}
          </Button>
        )}
      </div>
      <div
        className={cn(
          "grid gap-1.5 xl:gap-2",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-2",
          columns === "sidebar" &&
            "grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1 3xl:grid-cols-2"
        )}
      >
        {children}
      </div>
    </fieldset>
  );
}
