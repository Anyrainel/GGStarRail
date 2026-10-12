import { WandSparkles } from "lucide-react";
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
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import type { LightCone } from "@/domain/game-account/schemas";
import { useLightConeReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { LightConeDefinition } from "@/providers/reference/types";
import {
  localizedName,
  localizedSearchText,
} from "@/services/catalog/presentation";

type EquipmentGroup = "equipped" | "unequipped";
type LevelGroup = "max" | "other";
type LockStatus = "locked" | "unlocked" | "unknown-lock";

const LIGHT_CONE_RARITIES = [5, 4, 3] as const;
const LOCK_STATUSES: readonly { value: LockStatus; labelKey: MessageKey }[] = [
  { value: "locked", labelKey: "filter.locked" },
  { value: "unlocked", labelKey: "filter.unlocked" },
  { value: "unknown-lock", labelKey: "filter.unknownLock" },
];
const DEFAULT_LIGHT_CONE_LEVEL = 80;

interface InventoryLightConeSectionProps {
  lightCones: readonly LightCone[];
  iconSize: ItemIconSize;
}

interface LightConeTile {
  lightCone: LightCone;
  count: number;
}

export function InventoryLightConeSection({
  lightCones,
  iconSize,
}: InventoryLightConeSectionProps) {
  const { locale, t } = useI18n();
  const { data, error, loading } = useLightConeReferences();
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<Set<EquipmentGroup>>(
    () => new Set(["unequipped"])
  );
  const [levels, setLevels] = useState<Set<LevelGroup>>(() => new Set(["max"]));
  const [rarities, setRarities] = useState<Set<number>>(
    () => new Set(LIGHT_CONE_RARITIES)
  );
  const [paths, setPaths] = useState<Set<string>>(() => new Set());
  const [lockStatus, setLockStatus] = useState<Set<LockStatus>>(
    () => new Set()
  );

  const tiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visible = lightCones
      .filter((lightCone) =>
        equipment.has(
          lightCone.equippedCharacterKey ? "equipped" : "unequipped"
        )
      )
      .filter((lightCone) => {
        const definition = data?.lightCones.byId.get(lightCone.definitionId);
        if (!levels.has(levelGroup(lightCone, definition))) return false;
        if (definition && !rarities.has(definition.rarity)) return false;
        if (paths.size > 0 && !paths.has(lightCone.pathId)) return false;
        if (lockStatus.size > 0 && !lockStatus.has(lockOf(lightCone)))
          return false;
        if (!normalizedQuery) return true;
        return localizedSearchText(
          definition?.name,
          lightCone.definitionId
        ).includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftDefinition = data?.lightCones.byId.get(left.definitionId);
        const rightDefinition = data?.lightCones.byId.get(right.definitionId);
        const rarityDifference =
          (rightDefinition?.rarity ?? 0) - (leftDefinition?.rarity ?? 0);
        if (rarityDifference !== 0) return rarityDifference;
        return localizedName(
          leftDefinition?.name,
          locale,
          left.definitionId
        ).localeCompare(
          localizedName(rightDefinition?.name, locale, right.definitionId),
          locale
        );
      });
    return groupLightCones(visible);
  }, [
    data,
    equipment,
    levels,
    lightCones,
    locale,
    lockStatus,
    paths,
    query,
    rarities,
  ]);

  const pathIds = useMemo(
    () =>
      (data?.properties.paths ?? [])
        .map((path) => path.id)
        .filter((id) =>
          lightCones.some((lightCone) => lightCone.pathId === id)
        ),
    [data, lightCones]
  );

  if (lightCones.length === 0) {
    return (
      <EmptyState
        variant="inline"
        messageKey="empty.lightCones"
        icon={WandSparkles}
      />
    );
  }
  if (loading) return <CatalogLoading />;
  if (error || !data) return <CatalogLoadError error={error} />;

  const pathName = (id: string) =>
    localizedName(data.properties.pathById.get(id)?.name, locale, id);
  const clearAll = () => {
    setQuery("");
    setEquipment(new Set(["equipped", "unequipped"]));
    setLevels(new Set(["max", "other"]));
    setRarities(new Set(LIGHT_CONE_RARITIES));
    setPaths(new Set());
    setLockStatus(new Set());
  };

  return (
    <>
      <InventoryChipRow>
        <CategoryChip
          label={t("filter.unequipped")}
          active={equipment.has("unequipped")}
          onClick={() =>
            setEquipment((values) => toggled(values, "unequipped"))
          }
        />
        <CategoryChip
          label={t("filter.equipped")}
          active={equipment.has("equipped")}
          onClick={() => setEquipment((values) => toggled(values, "equipped"))}
        />
        <ChipGroupGap />
        <CategoryChip
          label={t("inventory.level.max")}
          active={levels.has("max")}
          onClick={() => setLevels((values) => toggled(values, "max"))}
        />
        <CategoryChip
          label={t("inventory.level.other")}
          active={levels.has("other")}
          onClick={() => setLevels((values) => toggled(values, "other"))}
        />
        <ChipGroupGap />
        {LIGHT_CONE_RARITIES.map((rarity) => (
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
          placeholder={t("search.lightCones")}
        />
      </InventoryChipRow>
      <InventoryChipRow className="gap-1">
        <FilterChipGroup
          className="contents"
          options={pathIds}
          selectedValues={paths}
          onSelectedValuesChange={setPaths}
          getKey={(id) => id}
          getTitle={pathName}
          getIcon={(id) => (
            <AssetImage
              kind="path"
              id={id}
              sourcePath={data.properties.pathById.get(id)?.icon_path}
              alt=""
              aria-hidden="true"
              className="h-4 w-4 shrink-0 object-contain"
            />
          )}
          getLabel={(id) => (
            <span className="hidden sm:inline">{pathName(id)}</span>
          )}
        />
        <ChipGroupGap />
        <FilterChipGroup
          className="contents"
          label={t("filter.status")}
          collapsible
          singleSelect
          options={LOCK_STATUSES}
          selectedValues={
            new Set(
              LOCK_STATUSES.filter((status) => lockStatus.has(status.value))
            )
          }
          onSelectedValuesChange={(next) =>
            setLockStatus(new Set([...next].map((status) => status.value)))
          }
          getKey={(status) => status.value}
          getLabel={(status) => t(status.labelKey)}
        />
      </InventoryChipRow>
      {tiles.length === 0 ? (
        <InventoryFilteredEmpty icon={WandSparkles} onClear={clearAll} />
      ) : (
        <section
          className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-3 px-2"
          aria-label={t("inventory.lightConesList")}
        >
          {tiles.map(({ lightCone, count }) => {
            const definition = data.lightCones.byId.get(lightCone.definitionId);
            const name = localizedName(
              definition?.name,
              locale,
              lightCone.definitionId
            );
            const label = [
              name,
              t("field.level", { value: lightCone.level }),
              t("field.superimposition", {
                value: lightCone.superimposition,
              }),
              lightCone.equippedCharacterKey ? t("field.equipped") : null,
              count > 1 ? t("inventory.copies", { count }) : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <CatalogHoverCard
                key={lightCone.key}
                kind="light-cone"
                id={definition?.id ?? lightCone.definitionId}
                disabled={!definition}
              >
                <div className="group flex min-w-0 flex-col items-center">
                  <div className="relative transition-transform duration-200 group-hover:scale-105">
                    <ItemIcon
                      kind="light-cone"
                      id={definition?.id ?? lightCone.definitionId}
                      sourcePath={definition?.icon_path ?? ""}
                      alt={label}
                      rarity={definition?.rarity ?? null}
                      badge={lightCone.superimposition}
                      level={`Lv. ${lightCone.level}`}
                      locked={lightCone.locked}
                      size={iconSize}
                      tabIndex={0}
                      className="outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {count > 1 && (
                      <div
                        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                        aria-hidden="true"
                      >
                        <span className="rounded-full bg-background/80 px-2 py-0.5 text-lg font-bold text-foreground shadow-xs backdrop-blur-[2px]">
                          x{count}
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    className="line-clamp-2 w-full min-w-0 break-words pt-1 text-center text-xs font-medium leading-tight text-foreground/90 transition-colors group-hover:text-foreground"
                    aria-hidden="true"
                  >
                    {name}
                  </span>
                </div>
              </CatalogHoverCard>
            );
          })}
        </section>
      )}
    </>
  );
}

function lockOf(lightCone: LightCone): LockStatus {
  if (lightCone.locked === null) return "unknown-lock";
  return lightCone.locked ? "locked" : "unlocked";
}

function levelGroup(
  lightCone: LightCone,
  definition: LightConeDefinition | undefined
): LevelGroup {
  const maxLevel =
    definition?.stat_scaling.at(-1)?.max_level ?? DEFAULT_LIGHT_CONE_LEVEL;
  return lightCone.level >= maxLevel ? "max" : "other";
}

/** Identical copies (same cone, level, rank, lock and equip state) share a tile. */
function groupLightCones(lightCones: readonly LightCone[]): LightConeTile[] {
  const tiles = new Map<string, LightConeTile>();
  for (const lightCone of lightCones) {
    const key = [
      lightCone.definitionId,
      lightCone.level,
      lightCone.superimposition,
      String(lightCone.locked),
      lightCone.equippedCharacterKey ? "equipped" : "spare",
    ].join("|");
    const tile = tiles.get(key);
    if (tile) tile.count += 1;
    else tiles.set(key, { lightCone, count: 1 });
  }
  return [...tiles.values()];
}
