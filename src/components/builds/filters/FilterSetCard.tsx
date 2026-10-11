import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import type { PickerItem } from "@/components/shared/ItemPicker";
import {
  CavernPlanIcon,
  PlanarSetIcon,
} from "@/components/shared/relic/SetPlanIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BuildRelicFilter } from "@/domain/build/filters";
import type { BuildConfiguration } from "@/domain/build/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import { buildDisplayName } from "@/lib/buildPresentation";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import type { RelicKind } from "@/lib/relicPresentation";
import { cn } from "@/lib/utils";
import type { CharacterDefinition } from "@/providers/reference/types";
import { setPlanBonuses, shortStatLabel } from "./filterPresentation";

interface FilterSetCardProps {
  kind: RelicKind;
  build: BuildConfiguration;
  /** This build's slot filters in slot order: 4 Cavern or 2 Planar. */
  filters: readonly BuildRelicFilter[];
  character: CharacterDefinition;
  characterName: string;
  references: BuildReferences;
  /** Set picker items by ID (name, art, rarity). */
  setsById: ReadonlyMap<string, PickerItem>;
  /** Matching account Relics per filter; null without account data. */
  matchCounts: ReadonlyMap<string, number> | null;
  selectedFilterId: string | null;
  onSelectFilter: (filterId: string) => void;
  /** Phone layout: smaller set and Character icons. */
  compact: boolean;
}

/**
 * One Relic set plan as GGArtifact's set card: the plan icon, name and bonus
 * line, then the build's slot rules as columns (Head | Hands | Body | Feet, or
 * Planar Sphere | Link Rope).
 */
export function FilterSetCard({
  kind,
  build,
  filters,
  character,
  characterName,
  references,
  setsById,
  matchCounts,
  selectedFilterId,
  onSelectFilter,
  compact,
}: FilterSetCardProps) {
  const { locale, t } = useI18n();
  const setIds = filters[0]?.setIds ?? [];
  const sets = setIds.flatMap((id) => setsById.get(id) ?? []);
  const setNames = setIds.map((id) =>
    localizedName(references.relicSets.byId.get(id)?.name, locale, id)
  );
  const bonuses = setPlanBonuses(
    setIds,
    references,
    locale,
    t("terms.trailblazer")
  );
  const bonusText = bonuses
    .map(({ pieces, text }) => `[${pieces}] ${text}`)
    .join(" ");
  const iconSize = compact ? "md" : "lg";

  return (
    <Card
      className="bg-gradient-card"
      data-filter-set-card={kind}
      aria-label={setNames.join(" + ")}
      role="region"
    >
      <CardHeader className="p-3 md:px-6 md:pb-3 md:pt-5">
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          {kind === "cavern" ? (
            <CavernPlanIcon sets={sets} size={iconSize} />
          ) : (
            <PlanarSetIcon set={sets[0] ?? null} size={iconSize} />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate text-base leading-tight md:text-xl">
              {setNames.join(" + ")}
            </CardTitle>
            {bonuses.length > 0 && (
              <p
                className="truncate pr-4 text-sm italic text-muted-foreground"
                title={bonusText}
              >
                {bonuses.map(({ key, pieces, text }, index) => (
                  <span key={key}>
                    {index > 0 && " "}
                    <span className="font-bold">[{pieces}]</span> {text}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0 md:px-6 md:pb-4">
        <div
          className="rounded-lg border border-border bg-muted/20 px-1.5 py-2 md:p-3"
          data-filter-config={build.id}
        >
          <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5 md:gap-3">
            <h4 className="min-w-0 truncate px-1 text-sm font-medium text-foreground md:px-2 md:text-base">
              {buildDisplayName(build, references, locale)}
            </h4>
            <div className="flex items-center gap-1 md:gap-1.5">
              <span className="hidden text-sm text-muted-foreground md:block">
                {t("filters.for")}
              </span>
              <CatalogHoverCard kind="character" id={character.id}>
                <ItemIcon
                  kind="character"
                  id={character.id}
                  sourcePath={character.icon_path}
                  rarity={character.rarity}
                  size={compact ? "xs" : "sm"}
                  alt={characterName}
                  tabIndex={0}
                />
              </CatalogHoverCard>
            </div>
          </div>
          <SlotRuleGrid
            filters={filters}
            references={references}
            matchCounts={matchCounts}
            selectedFilterId={selectedFilterId}
            onSelectFilter={onSelectFilter}
          />
        </div>
      </CardContent>
    </Card>
  );
}

const FIXED_MAIN_SLOTS = new Set(["head", "hands"]);

function SlotRuleGrid({
  filters,
  references,
  matchCounts,
  selectedFilterId,
  onSelectFilter,
}: Pick<
  FilterSetCardProps,
  | "filters"
  | "references"
  | "matchCounts"
  | "selectedFilterId"
  | "onSelectFilter"
>) {
  const { locale, t } = useI18n();
  const propertyName = (propertyId: string) =>
    localizedPropertyName(propertyId, references.properties, locale);
  const slotName = (filter: BuildRelicFilter) =>
    localizedName(
      references.properties.relicSlotById.get(CATALOG_RELIC_SLOT[filter.slot])
        ?.name,
      locale,
      filter.slot
    );
  const labelClass = "mb-1 block text-[11px] text-muted-foreground md:text-xs";

  return (
    <div
      className={cn(
        "grid gap-x-1.5 gap-y-1 border-t border-border pt-2 md:gap-x-3 md:gap-y-2",
        filters.length > 2 ? "grid-cols-4" : "grid-cols-2"
      )}
      data-filter-slot-grid={filters.length}
    >
      {filters.map((filter) => {
        const selected = filter.id === selectedFilterId;
        const count = matchCounts?.get(filter.id);
        const countText =
          count === undefined
            ? null
            : t(count === 1 ? "filters.matchCountOne" : "filters.matchCount", {
                count,
              });
        const name = slotName(filter);
        return (
          <button
            key={`${filter.id}:head`}
            type="button"
            aria-pressed={selected}
            aria-label={countText ? `${name}, ${countText}` : name}
            title={countText ?? undefined}
            onClick={() => onSelectFilter(filter.id)}
            className={cn(
              "flex min-w-0 items-center justify-between gap-1 rounded-md px-1 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:px-2",
              selected
                ? "bg-primary/15 ring-1 ring-primary/30"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
            data-filter-slot={filter.slot}
          >
            <span className="min-w-0 truncate text-xs font-semibold md:text-sm">
              {name}
            </span>
            {count !== undefined && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 font-mono text-[11px] tabular-nums leading-5",
                  count > 0
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
                aria-hidden="true"
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      {filters.map((filter) => (
        <div key={`${filter.id}:main`} className="min-w-0">
          <span className={labelClass}>{t("filters.mainStats")}</span>
          {FIXED_MAIN_SLOTS.has(filter.slot) ? (
            <span
              className="text-[11px] text-muted-foreground md:text-xs"
              title={t("build.fixed")}
            >
              {filter.mainStatIds
                .map((id) => shortStatLabel(id, propertyName(id), t))
                .join(" / ")}
            </span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {filter.mainStatIds.map((id) => (
                <StatChip
                  key={id}
                  label={shortStatLabel(id, propertyName(id), t)}
                  title={propertyName(id)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {filters.map((filter) => {
        const mustHave = new Set(filter.mustHaveStatIds);
        const ordered = [
          ...filter.weightedStatIds.filter((id) => mustHave.has(id)),
          ...filter.weightedStatIds.filter((id) => !mustHave.has(id)),
        ];
        return (
          <div key={`${filter.id}:subs`} className="min-w-0">
            <span className={labelClass}>
              {t("filters.weightedStats")}
              {ordered.length > 0 && (
                <>
                  {" "}
                  <span className="whitespace-nowrap font-semibold text-foreground">
                    [
                    {t("filters.minimumStats", {
                      count: filter.minimumDesiredStats,
                    })}
                    ]
                  </span>
                </>
              )}
            </span>
            {ordered.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {ordered.map((id) => (
                  <StatChip
                    key={id}
                    label={shortStatLabel(id, propertyName(id), t)}
                    title={
                      mustHave.has(id)
                        ? `${propertyName(id)} · ${t("filters.mustHaveStats")}`
                        : propertyName(id)
                    }
                    emphasis={mustHave.has(id)}
                  />
                ))}
              </div>
            ) : (
              <span className="text-[11px] italic text-muted-foreground md:text-xs">
                {t("filters.noneRequired")}
              </span>
            )}
          </div>
        );
      })}

      {filters.map((filter) => (
        <div
          key={`${filter.id}:score`}
          className="min-w-0 self-end rounded-md bg-muted/50 px-1 py-0.5 md:px-2 md:py-1"
        >
          <div className="space-y-0.5 md:hidden">
            <div className="text-[11px] leading-tight text-muted-foreground">
              {t("filters.minimumScore")}
            </div>
            <div className="text-xs font-medium tabular-nums">
              {filter.minimumScore}
            </div>
          </div>
          <div className="hidden items-center justify-between gap-2 md:flex">
            <div className="truncate text-xs text-muted-foreground">
              {t("filters.minimumScore")}
            </div>
            <div className="text-sm font-medium tabular-nums">
              {filter.minimumScore}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatChip({
  label,
  title,
  emphasis = false,
}: {
  label: string;
  title: string;
  emphasis?: boolean;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md border px-1 py-0 text-[11px] leading-5 md:px-2 md:text-xs",
        emphasis
          ? "border-[hsl(var(--quality-gold)/0.45)] bg-[hsl(var(--quality-gold)/0.12)] text-[hsl(var(--quality-gold))]"
          : "border-border bg-secondary text-secondary-foreground"
      )}
      data-stat-chip={emphasis ? "must-have" : "desired"}
    >
      {label}
    </span>
  );
}
