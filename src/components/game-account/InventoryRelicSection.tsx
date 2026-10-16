import { ChevronDown, Gem, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ChipGroupGap,
  InventoryChipRow,
  InventoryFilteredEmpty,
  InventorySearch,
  toggled,
} from "@/components/game-account/InventorySection";
import { AssetImage } from "@/components/shared/AssetImage";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import { CategoryChip } from "@/components/shared/CategoryChip";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterChip } from "@/components/shared/FilterChip";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import {
  ItemIcon,
  type ItemIconSize,
  itemIconWidth,
} from "@/components/shared/ItemIcon";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { RelicSlotChips } from "@/components/shared/relic/RelicSlotChips";
import { VirtualCollection } from "@/components/shared/VirtualCollection";
import { type Relic, relicCategory } from "@/domain/game-account/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useRelicReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";
import type { RelicPieceDefinition } from "@/providers/reference/types";
import {
  localizedName,
  localizedSearchText,
} from "@/services/catalog/presentation";
import {
  RELIC_SLOTS,
  type RelicKind,
  type RelicSlotId,
} from "@/services/catalog/relicPresentation";

type EquipmentGroup = "equipped" | "unequipped";
type RelicLevelGroup = "max" | "enhanced" | "zero";
type RelicStatus =
  | "locked"
  | "unlocked"
  | "unknown-lock"
  | "discarded"
  | "not-discarded"
  | "unknown-discard";

const RELIC_RARITIES = [5, 4, 3, 2] as const;
const RELIC_KINDS = [
  "cavern",
  "planar",
] as const satisfies readonly RelicKind[];
const STATUSES: readonly { value: RelicStatus; labelKey: MessageKey }[] = [
  { value: "locked", labelKey: "filter.locked" },
  { value: "unlocked", labelKey: "filter.unlocked" },
  { value: "unknown-lock", labelKey: "filter.unknownLock" },
  { value: "discarded", labelKey: "filter.discarded" },
  { value: "not-discarded", labelKey: "filter.notDiscarded" },
  { value: "unknown-discard", labelKey: "filter.unknownDiscard" },
];
const LEVEL_GROUPS: readonly {
  value: RelicLevelGroup;
  labelKey: MessageKey;
}[] = [
  { value: "max", labelKey: "inventory.level.max" },
  { value: "enhanced", labelKey: "inventory.level.enhanced" },
  { value: "zero", labelKey: "inventory.level.zero" },
];
const SLOT_ORDER = new Map<RelicSlotId, number>(
  RELIC_SLOTS.map((slot, index) => [slot, index])
);

interface InventoryRelicSectionProps {
  relics: readonly Relic[];
  iconSize: ItemIconSize;
}

export function InventoryRelicSection({
  relics,
  iconSize,
}: InventoryRelicSectionProps) {
  const { locale, t } = useI18n();
  const { data, error, loading } = useRelicReferences();
  const [query, setQuery] = useState("");
  const [slots, setSlots] = useState<Set<RelicSlotId>>(() => new Set());
  const [equipmentGroups, setEquipmentGroups] = useState<Set<EquipmentGroup>>(
    () => new Set(["unequipped"])
  );
  const [levelGroups, setLevelGroups] = useState<Set<RelicLevelGroup>>(
    () => new Set(["max"])
  );
  const [rarities, setRarities] = useState<Set<number>>(
    () => new Set(RELIC_RARITIES)
  );
  const [setIds, setSetIds] = useState<Set<string>>(() => new Set());
  const [setsOpen, setSetsOpen] = useState(false);
  const [statuses, setStatuses] = useState<Set<RelicStatus>>(() => new Set());

  const setOptions = useMemo(() => {
    const counts = new Map<string, { kind: RelicKind; count: number }>();
    for (const relic of relics) {
      const entry = counts.get(relic.setId);
      if (entry) entry.count += 1;
      else
        counts.set(relic.setId, {
          kind: relicCategory(relic.slot),
          count: 1,
        });
    }
    const options = [...counts].map(([id, { kind, count }]) => ({
      id,
      kind,
      count,
      name: localizedName(data?.relicSets.byId.get(id)?.name, locale, id),
      iconPath: data?.relicSets.byId.get(id)?.icon_path,
    }));
    options.sort((left, right) => left.name.localeCompare(right.name, locale));
    return options;
  }, [data, locale, relics]);

  const visibleRelics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return relics
      .filter((relic) => slots.size === 0 || slots.has(relic.slot))
      .filter((relic) =>
        equipmentGroups.has(
          relic.equippedCharacterKey ? "equipped" : "unequipped"
        )
      )
      .filter((relic) => {
        const piece = data?.relicPieces.byId.get(relic.definitionId);
        return levelGroups.has(relicLevelGroup(relic, piece));
      })
      .filter(
        (relic) =>
          !(RELIC_RARITIES as readonly number[]).includes(relic.rarity) ||
          rarities.has(relic.rarity)
      )
      .filter((relic) => setIds.size === 0 || setIds.has(relic.setId))
      .filter(
        (relic) =>
          statuses.size === 0 ||
          [...statuses].some((status) => matchesStatus(relic, status))
      )
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
        const slotDifference =
          (SLOT_ORDER.get(left.slot) ?? 0) - (SLOT_ORDER.get(right.slot) ?? 0);
        if (slotDifference !== 0) return slotDifference;
        return right.level - left.level;
      });
  }, [
    data,
    equipmentGroups,
    levelGroups,
    locale,
    query,
    rarities,
    relics,
    setIds,
    slots,
    statuses,
  ]);

  if (relics.length === 0) {
    return (
      <EmptyState variant="inline" messageKey="empty.relicsAll" icon={Gem} />
    );
  }
  if (loading) return <CatalogLoading />;
  if (error || !data) return <CatalogLoadError error={error} />;

  const slotName = (slot: RelicSlotId) =>
    localizedName(
      data.properties.relicSlotById.get(CATALOG_RELIC_SLOT[slot])?.name,
      locale,
      slot
    );
  const clearAll = () => {
    setQuery("");
    setSlots(new Set());
    setEquipmentGroups(new Set(["equipped", "unequipped"]));
    setLevelGroups(new Set(["max", "enhanced", "zero"]));
    setRarities(new Set(RELIC_RARITIES));
    setSetIds(new Set());
    setStatuses(new Set());
  };
  const setChipIcon = (iconPath: string | undefined, id: string) => (
    <AssetImage
      kind="relic-set"
      id={id}
      sourcePath={iconPath}
      alt=""
      aria-hidden="true"
      className="h-4 w-4 shrink-0 object-contain"
    />
  );
  const setChipGroup = (kind: RelicKind) => {
    const options = setOptions.filter((option) => option.kind === kind);
    if (options.length === 0) return null;
    return (
      <div
        key={kind}
        className="flex basis-full flex-wrap items-center gap-1"
        data-relic-set-row={kind}
      >
        <RelicKindIcon kind={kind} className="mr-0.5 text-muted-foreground" />
        <FilterChipGroup
          className="contents"
          options={options}
          selectedValues={
            new Set(options.filter((option) => setIds.has(option.id)))
          }
          emptyMeansAll={setIds.size === 0}
          onSelectedValuesChange={(next) => {
            const others = [...setIds].filter(
              (id) => !options.some((option) => option.id === id)
            );
            setSetIds(new Set([...others, ...[...next].map((o) => o.id)]));
          }}
          getKey={(option) => option.id}
          getTitle={(option) => option.name}
          getIcon={(option) => setChipIcon(option.iconPath, option.id)}
          getCount={(option) => option.count}
          getLabel={(option) => (
            <span className="max-w-40 truncate">{option.name}</span>
          )}
        />
      </div>
    );
  };

  return (
    <>
      <InventoryChipRow className="gap-1">
        <RelicSlotChips
          value={slots}
          onChange={setSlots}
          slotLabel={slotName}
        />
      </InventoryChipRow>
      <InventoryChipRow>
        <CategoryChip
          label={t("filter.unequipped")}
          active={equipmentGroups.has("unequipped")}
          onClick={() =>
            setEquipmentGroups((values) => toggled(values, "unequipped"))
          }
        />
        <CategoryChip
          label={t("filter.equipped")}
          active={equipmentGroups.has("equipped")}
          onClick={() =>
            setEquipmentGroups((values) => toggled(values, "equipped"))
          }
        />
        <ChipGroupGap />
        {LEVEL_GROUPS.map(({ value: group, labelKey }) => (
          <CategoryChip
            key={group}
            label={t(labelKey)}
            active={levelGroups.has(group)}
            onClick={() => setLevelGroups((values) => toggled(values, group))}
          />
        ))}
        <ChipGroupGap />
        {RELIC_RARITIES.map((rarity) => (
          <CategoryChip
            key={rarity}
            label={t("inventory.rarity", { value: rarity })}
            active={rarities.has(rarity)}
            onClick={() => setRarities((values) => toggled(values, rarity))}
          />
        ))}
        <InventorySearch
          value={query}
          onValueChange={setQuery}
          placeholder={t("search.relics")}
        />
      </InventoryChipRow>
      <InventoryChipRow className="gap-1">
        <button
          type="button"
          aria-expanded={setsOpen}
          onClick={() => setSetsOpen((value) => !value)}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/30 px-3 text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-background/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("inventory.filterBySet")}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              setsOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
        {!setsOpen &&
          setOptions
            .filter((option) => setIds.has(option.id))
            .map((option) => (
              <FilterChip
                key={option.id}
                active
                onClick={() =>
                  setSetIds((values) => toggled(values, option.id))
                }
                icon={setChipIcon(option.iconPath, option.id)}
                count={option.count}
                title={option.name}
                aria-label={option.name}
              >
                <span className="max-w-40 truncate">{option.name}</span>
              </FilterChip>
            ))}
        <ChipGroupGap />
        <FilterChipGroup
          className="contents"
          label={t("filter.status")}
          collapsible
          singleSelect
          options={STATUSES}
          selectedValues={
            new Set(STATUSES.filter((status) => statuses.has(status.value)))
          }
          onSelectedValuesChange={(next) =>
            setStatuses(new Set([...next].map((status) => status.value)))
          }
          getKey={(status) => status.value}
          getLabel={(status) => t(status.labelKey)}
        />
        {setsOpen && RELIC_KINDS.map(setChipGroup)}
      </InventoryChipRow>
      {visibleRelics.length === 0 ? (
        <InventoryFilteredEmpty icon={Gem} onClear={clearAll} />
      ) : (
        <section className="space-y-3" aria-label={t("inventory.relicsList")}>
          {RELIC_KINDS.map((kind) => {
            const group = visibleRelics.filter(
              (relic) => relicCategory(relic.slot) === kind
            );
            if (group.length === 0) return null;
            return (
              <div key={kind} className="space-y-2" data-relic-group={kind}>
                <h3 className="flex items-center gap-1.5 px-2 text-sm font-medium text-foreground/90">
                  <RelicKindIcon
                    kind={kind}
                    decorative
                    className="text-muted-foreground"
                  />
                  {t("inventory.groupCount", {
                    name: t(
                      kind === "cavern"
                        ? "relic.kind.cavern"
                        : "relic.kind.planar"
                    ),
                    count: group.length,
                  })}
                </h3>
                <div className="px-2">
                  <VirtualCollection
                    items={group}
                    getKey={(relic) => relic.key}
                    tileWidth={itemIconWidth(iconSize)}
                  >
                    {(relic) => (
                      <RelicTile
                        key={relic.key}
                        relic={relic}
                        piece={data.relicPieces.byId.get(relic.definitionId)}
                        setName={localizedName(
                          data.relicSets.byId.get(relic.setId)?.name,
                          locale,
                          relic.setId
                        )}
                        slotName={slotName(relic.slot)}
                        iconSize={iconSize}
                      />
                    )}
                  </VirtualCollection>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

function RelicTile({
  relic,
  piece,
  setName,
  slotName,
  iconSize,
}: {
  relic: Relic;
  piece: RelicPieceDefinition | undefined;
  setName: string;
  slotName: string;
  iconSize: ItemIconSize;
}) {
  const { locale, t } = useI18n();
  const name = localizedName(piece?.name, locale, relic.definitionId);
  const label = [
    name,
    `+${relic.level}`,
    setName,
    slotName,
    relic.equippedCharacterKey ? t("field.equipped") : null,
    relic.locked === true
      ? t("field.locked")
      : relic.locked === null
        ? t("field.lockUnknown")
        : null,
    relic.discarded === true
      ? t("field.discarded")
      : relic.discarded === null
        ? t("field.discardUnknown")
        : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <CatalogHoverCard
      kind="relic-piece"
      id={piece?.id ?? relic.definitionId}
      relic={relic}
      disabled={!piece}
    >
      <ItemIcon
        kind="relic-piece"
        id={piece?.id ?? relic.definitionId}
        sourcePath={piece?.icon_path ?? ""}
        alt={label}
        rarity={relic.rarity}
        level={`+${relic.level}`}
        locked={relic.locked}
        marker={
          relic.discarded === true
            ? {
                icon: Trash2,
                label: t("field.discarded"),
                tone: "destructive",
              }
            : undefined
        }
        size={iconSize}
        tabIndex={0}
        className="rounded-md outline-hidden transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
        data-relic-key={relic.key}
      />
    </CatalogHoverCard>
  );
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
  }
}
