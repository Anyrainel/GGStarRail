import { Gem } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { InventoryToolbar } from "@/components/account/InventoryToolbar";
import {
  type InventoryFilterChip,
  InventoryFilterChips,
} from "@/components/account-data/InventoryFilterChips";
import { AssetImage } from "@/components/shared/AssetImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  type Relic,
  type RelicCategory,
  type RelicSlot,
  relicCategory,
} from "@/domain/account/schemas";
import { useRelicReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import {
  formatAccountStatValue,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import type {
  PropertyCatalog,
  RelicPieceDefinition,
  RelicSlotId,
} from "@/providers/gilore/types";

type EquipmentGroup = "equipped" | "unequipped";
type RelicLevelGroup = "max" | "enhanced" | "zero";
type RelicStatus =
  | "all"
  | "locked"
  | "unlocked"
  | "unknown-lock"
  | "discarded"
  | "not-discarded"
  | "unknown-discard";

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, RelicSlotId>;

const SLOT_ORDER: Record<RelicSlot, number> = {
  head: 0,
  hands: 1,
  body: 2,
  feet: 3,
  planarSphere: 4,
  linkRope: 5,
};

const RELIC_RARITIES = [5, 4, 3, 2, 1] as const;

interface InventoryRelicSectionProps {
  relics: readonly Relic[];
}

export function InventoryRelicSection({ relics }: InventoryRelicSectionProps) {
  const { locale, t } = useI18n();
  const { data, error, loading } = useRelicReferences();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<RelicCategory>>(
    () => new Set(["cavern", "planar"])
  );
  const [equipmentGroups, setEquipmentGroups] = useState<Set<EquipmentGroup>>(
    () => new Set(["equipped", "unequipped"])
  );
  const [levelGroups, setLevelGroups] = useState<Set<RelicLevelGroup>>(
    () => new Set(["max", "enhanced", "zero"])
  );
  const [rarities, setRarities] = useState<Set<number>>(
    () => new Set(RELIC_RARITIES)
  );
  const [slot, setSlot] = useState<"all" | RelicSlot>("all");
  const [setId, setSetId] = useState("all");
  const [status, setStatus] = useState<RelicStatus>("all");

  const visibleRelics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return relics
      .filter((relic) => categories.has(relicCategory(relic.slot)))
      .filter((relic) =>
        equipmentGroups.has(
          relic.equippedCharacterKey ? "equipped" : "unequipped"
        )
      )
      .filter((relic) => {
        const piece = data?.relicPieces.byId.get(relic.definitionId);
        return levelGroups.has(relicLevelGroup(relic, piece));
      })
      .filter((relic) => rarities.has(relic.rarity))
      .filter((relic) => slot === "all" || relic.slot === slot)
      .filter((relic) => setId === "all" || relic.setId === setId)
      .filter((relic) => matchesStatus(relic, status))
      .filter((relic) => {
        if (!normalizedQuery) return true;
        const piece = data?.relicPieces.byId.get(relic.definitionId);
        const setDefinition = data?.relicSets.byId.get(relic.setId);
        return [
          localizedSearchText(piece?.name, relic.definitionId),
          localizedSearchText(setDefinition?.name, relic.setId),
        ].some((value) => value.includes(normalizedQuery));
      })
      .sort((left, right) => {
        const categoryDifference =
          (relicCategory(left.slot) === "planar" ? 1 : 0) -
          (relicCategory(right.slot) === "planar" ? 1 : 0);
        if (categoryDifference !== 0) return categoryDifference;

        const leftSet = data?.relicSets.byId.get(left.setId);
        const rightSet = data?.relicSets.byId.get(right.setId);
        const setDifference = localizedName(
          leftSet?.name,
          locale,
          left.setId
        ).localeCompare(
          localizedName(rightSet?.name, locale, right.setId),
          locale
        );
        if (setDifference !== 0) return setDifference;

        const slotDifference = SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot];
        if (slotDifference !== 0) return slotDifference;
        return right.level - left.level;
      });
  }, [
    categories,
    data,
    equipmentGroups,
    levelGroups,
    locale,
    query,
    rarities,
    relics,
    setId,
    slot,
    status,
  ]);

  const slotOptions = useMemo(
    () => [
      { value: "all", label: t("filter.allSlots") },
      ...Array.from(new Set(relics.map((relic) => relic.slot)))
        .sort((left, right) => SLOT_ORDER[left] - SLOT_ORDER[right])
        .map((domainSlot) => ({
          value: domainSlot,
          label: localizedName(
            data?.properties.relicSlotById.get(
              DOMAIN_SLOT_TO_CATALOG[domainSlot]
            )?.name,
            locale,
            domainSlot
          ),
        })),
    ],
    [data, locale, relics, t]
  );

  const setOptions = useMemo(
    () => [
      { value: "all", label: t("filter.allSets") },
      ...Array.from(new Set(relics.map((relic) => relic.setId)))
        .map((id) => ({
          value: id,
          label: localizedName(data?.relicSets.byId.get(id)?.name, locale, id),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    ],
    [data, locale, relics, t]
  );

  const categoryChips: InventoryFilterChip[] = [
    {
      value: "cavern",
      label: t("inventory.category.cavern"),
      active: categories.has("cavern"),
      onToggle: () => setCategories((values) => toggled(values, "cavern")),
    },
    {
      value: "planar",
      label: t("inventory.category.planar"),
      active: categories.has("planar"),
      onToggle: () => setCategories((values) => toggled(values, "planar")),
    },
  ];
  const equipmentChips: InventoryFilterChip[] = [
    {
      value: "equipped",
      label: t("filter.equipped"),
      active: equipmentGroups.has("equipped"),
      onToggle: () =>
        setEquipmentGroups((values) => toggled(values, "equipped")),
    },
    {
      value: "unequipped",
      label: t("filter.unequipped"),
      active: equipmentGroups.has("unequipped"),
      onToggle: () =>
        setEquipmentGroups((values) => toggled(values, "unequipped")),
    },
  ];
  const levelChips: InventoryFilterChip[] = [
    {
      value: "max",
      label: t("inventory.level.max"),
      active: levelGroups.has("max"),
      onToggle: () => setLevelGroups((values) => toggled(values, "max")),
    },
    {
      value: "enhanced",
      label: t("inventory.level.enhanced"),
      active: levelGroups.has("enhanced"),
      onToggle: () => setLevelGroups((values) => toggled(values, "enhanced")),
    },
    {
      value: "zero",
      label: t("inventory.level.zero"),
      active: levelGroups.has("zero"),
      onToggle: () => setLevelGroups((values) => toggled(values, "zero")),
    },
  ];
  const rarityChips: InventoryFilterChip[] = RELIC_RARITIES.map((rarity) => ({
    value: String(rarity),
    label: t("field.rarity", { value: rarity }),
    active: rarities.has(rarity),
    onToggle: () => setRarities((values) => toggled(values, rarity)),
  }));

  if (relics.length === 0) {
    return <EmptyState messageKey="empty.relicsAll" icon={Gem} />;
  }
  if (loading) return <CatalogLoading />;
  if (error || !data) return <CatalogLoadError error={error} />;

  return (
    <div className="space-y-3">
      <section
        className="grid gap-3 rounded-xl border border-border bg-card/70 p-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t("inventory.quickFilters")}
      >
        <InventoryFilterChips
          label={t("filter.category")}
          chips={categoryChips}
        />
        <InventoryFilterChips
          label={t("inventory.filter.equipment")}
          chips={equipmentChips}
        />
        <InventoryFilterChips label={t("filter.level")} chips={levelChips} />
        <InventoryFilterChips label={t("filter.rarity")} chips={rarityChips} />
      </section>
      <InventoryToolbar
        query={query}
        searchLabel={t("common.search")}
        searchPlaceholder={t("search.relics")}
        countLabel={
          visibleRelics.length === 1
            ? t("common.oneRecord")
            : t("common.count", { count: visibleRelics.length })
        }
        onQueryChange={setQuery}
        filters={[
          {
            id: "inventory-relic-slot",
            label: t("filter.slot"),
            value: slot,
            options: slotOptions,
            onChange: (value) => setSlot(value as "all" | RelicSlot),
          },
          {
            id: "inventory-relic-set",
            label: t("filter.set"),
            value: setId,
            options: setOptions,
            onChange: setSetId,
          },
          {
            id: "inventory-relic-status",
            label: t("filter.status"),
            value: status,
            options: [
              { value: "all", label: t("filter.allStatuses") },
              { value: "locked", label: t("filter.locked") },
              { value: "unlocked", label: t("filter.unlocked") },
              { value: "unknown-lock", label: t("filter.unknownLock") },
              { value: "discarded", label: t("filter.discarded") },
              {
                value: "not-discarded",
                label: t("filter.notDiscarded"),
              },
              {
                value: "unknown-discard",
                label: t("filter.unknownDiscard"),
              },
            ],
            onChange: (value) => setStatus(value as RelicStatus),
          },
        ]}
      />
      {visibleRelics.length === 0 ? (
        <EmptyState messageKey="empty.filtered" icon={Gem} />
      ) : (
        <section
          className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3"
          aria-label={t("inventory.relicsList")}
        >
          {visibleRelics.map((relic) => {
            const piece = data.relicPieces.byId.get(relic.definitionId);
            const setDefinition = data.relicSets.byId.get(relic.setId);
            const name = localizedName(piece?.name, locale, relic.definitionId);
            const setName = localizedName(
              setDefinition?.name,
              locale,
              relic.setId
            );
            const slotDefinition = data.properties.relicSlotById.get(
              DOMAIN_SLOT_TO_CATALOG[relic.slot]
            );
            return (
              <Card key={relic.key} className="overflow-hidden">
                <CardContent className="space-y-2.5 p-3">
                  <div className="flex items-start gap-3">
                    <AssetImage
                      kind="relic-piece"
                      id={piece?.id ?? relic.definitionId}
                      sourcePath={piece?.icon_path ?? ""}
                      alt={name}
                      className="h-14 w-14 shrink-0 rounded-lg bg-background/70 object-contain"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-5">
                        {name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {setName}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Badge>+{relic.level}</Badge>
                        <Badge variant="secondary">
                          {t("field.rarity", { value: relic.rarity })}
                        </Badge>
                        <Badge variant="outline">
                          {localizedName(
                            slotDefinition?.name,
                            locale,
                            relic.slot
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {relic.equippedCharacterKey && (
                      <Badge variant="outline">{t("field.equipped")}</Badge>
                    )}
                    {relic.locked === true && (
                      <Badge variant="outline">{t("field.locked")}</Badge>
                    )}
                    {relic.locked === null && (
                      <Badge variant="outline">{t("field.lockUnknown")}</Badge>
                    )}
                    {relic.discarded === true && (
                      <Badge variant="outline">{t("field.discarded")}</Badge>
                    )}
                    {relic.discarded === null && (
                      <Badge variant="outline">
                        {t("field.discardUnknown")}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2">
                    <StatLine
                      statId={relic.mainStat.statId}
                      value={relic.mainStat.value}
                      properties={data.properties}
                      prominent
                    />
                    {relic.substats.map((stat) => (
                      <StatLine
                        key={stat.statId}
                        statId={stat.statId}
                        value={stat.value}
                        properties={data.properties}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );

  function StatLine({
    statId,
    value,
    properties,
    prominent = false,
  }: {
    statId: string;
    value: number;
    properties: PropertyCatalog;
    prominent?: boolean;
  }) {
    const property = properties.propertyById.get(statId);
    return (
      <p
        className={
          prominent
            ? "col-span-2 flex min-w-0 justify-between gap-2 text-xs font-medium"
            : "flex min-w-0 justify-between gap-2 text-xs text-muted-foreground"
        }
      >
        <span className="truncate">
          {localizedName(
            property?.relic_name ?? property?.name,
            locale,
            statId
          )}
        </span>
        <span className="shrink-0 tabular-nums">
          {formatAccountStatValue(value, property, locale)}
        </span>
      </p>
    );
  }
}

function toggled<T>(values: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function relicLevelGroup(
  relic: Relic,
  definition: RelicPieceDefinition | undefined
): RelicLevelGroup {
  if (relic.level === 0) return "zero";
  const fallbackMaxLevel = Math.min(15, relic.rarity * 3);
  return relic.level >= (definition?.max_level ?? fallbackMaxLevel)
    ? "max"
    : "enhanced";
}

function matchesStatus(relic: Relic, status: RelicStatus): boolean {
  switch (status) {
    case "locked":
      return relic.locked === true;
    case "unlocked":
      return relic.locked === false;
    case "unknown-lock":
      return relic.locked === null;
    case "discarded":
      return relic.discarded === true;
    case "not-discarded":
      return relic.discarded === false;
    case "unknown-discard":
      return relic.discarded === null;
    case "all":
      return true;
  }
}
