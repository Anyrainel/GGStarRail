import { UsersRound } from "lucide-react";
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
import {
  ItemIcon,
  type ItemIconSize,
  itemIconWidth,
} from "@/components/shared/ItemIcon";
import type { Character } from "@/domain/game-account/schemas";
import { useCharacterReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import type { CharacterDefinition } from "@/providers/reference/types";
import {
  characterCatalogName,
  localizedName,
  localizedSearchText,
} from "@/services/catalog/presentation";

type LevelGroup = "max" | "other";

const CHARACTER_RARITIES = [5, 4] as const;
const DEFAULT_CHARACTER_LEVEL = 80;

interface InventoryCharacterSectionProps {
  characters: readonly Character[];
  iconSize: ItemIconSize;
}

export function InventoryCharacterSection({
  characters,
  iconSize,
}: InventoryCharacterSectionProps) {
  const { locale, t } = useI18n();
  const { data, error, loading } = useCharacterReferences();
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<Set<LevelGroup>>(() => new Set(["max"]));
  const [rarities, setRarities] = useState<Set<number>>(
    () => new Set(CHARACTER_RARITIES)
  );
  const [combatTypes, setCombatTypes] = useState<Set<string>>(() => new Set());
  const [paths, setPaths] = useState<Set<string>>(() => new Set());

  const visibleCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return characters
      .filter((character) => paths.size === 0 || paths.has(character.pathId))
      .filter(
        (character) =>
          combatTypes.size === 0 || combatTypes.has(character.combatTypeId)
      )
      .filter((character) => {
        const definition = data?.characters.byId.get(character.definitionId);
        if (!levels.has(levelGroup(character, definition))) return false;
        if (definition && !rarities.has(definition.rarity)) return false;
        if (!normalizedQuery) return true;
        const displayName = definition
          ? characterCatalogName(definition, locale, t("terms.trailblazer"))
          : character.definitionId;
        return `${displayName} ${localizedSearchText(
          definition?.name,
          character.definitionId
        )}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftDefinition = data?.characters.byId.get(left.definitionId);
        const rightDefinition = data?.characters.byId.get(right.definitionId);
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
  }, [
    characters,
    combatTypes,
    data,
    levels,
    locale,
    paths,
    query,
    rarities,
    t,
  ]);

  const combatTypeIds = useMemo(
    () =>
      (data?.properties.combatTypes ?? [])
        .map((combatType) => combatType.id)
        .filter((id) =>
          characters.some((character) => character.combatTypeId === id)
        ),
    [characters, data]
  );
  const pathIds = useMemo(
    () =>
      (data?.properties.paths ?? [])
        .map((path) => path.id)
        .filter((id) =>
          characters.some((character) => character.pathId === id)
        ),
    [characters, data]
  );

  if (characters.length === 0) {
    return (
      <EmptyState
        variant="inline"
        messageKey="empty.inventoryCharacters"
        icon={UsersRound}
      />
    );
  }
  if (loading) return <CatalogLoading />;
  if (error || !data) return <CatalogLoadError error={error} />;

  const combatTypeName = (id: string) =>
    localizedName(data.properties.combatTypeById.get(id)?.name, locale, id);
  const pathName = (id: string) =>
    localizedName(data.properties.pathById.get(id)?.name, locale, id);
  const clearAll = () => {
    setQuery("");
    setLevels(new Set(["max", "other"]));
    setRarities(new Set(CHARACTER_RARITIES));
    setCombatTypes(new Set());
    setPaths(new Set());
  };

  return (
    <>
      <InventoryChipRow>
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
        {CHARACTER_RARITIES.map((rarity) => (
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
          placeholder={t("search.characters")}
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
          label={t("filter.combatType")}
          collapsible
          options={combatTypeIds}
          selectedValues={combatTypes}
          onSelectedValuesChange={setCombatTypes}
          getKey={(id) => id}
          getTitle={combatTypeName}
          getIcon={(id) => (
            <AssetImage
              kind="combat-type"
              id={id}
              sourcePath={data.properties.combatTypeById.get(id)?.icon_path}
              alt=""
              aria-hidden="true"
              className="h-4 w-4 shrink-0 object-contain"
            />
          )}
          getLabel={(id) => (
            <span className="hidden sm:inline">{combatTypeName(id)}</span>
          )}
        />
      </InventoryChipRow>
      {visibleCharacters.length === 0 ? (
        <InventoryFilteredEmpty icon={UsersRound} onClear={clearAll} />
      ) : (
        <section
          className="flex flex-wrap gap-3 px-2"
          aria-label={t("inventory.charactersList")}
        >
          {visibleCharacters.map((character) => {
            const definition = data.characters.byId.get(character.definitionId);
            const name = definition
              ? characterCatalogName(definition, locale, t("terms.trailblazer"))
              : character.definitionId;
            const combatType = data.properties.combatTypeById.get(
              character.combatTypeId
            );
            return (
              <CatalogHoverCard
                key={character.key}
                kind="character"
                id={definition?.id ?? character.definitionId}
                disabled={!definition}
              >
                <div
                  className="group flex shrink-0 flex-col items-center"
                  style={{ width: itemIconWidth(iconSize) }}
                >
                  <ItemIcon
                    kind="character"
                    id={definition?.id ?? character.definitionId}
                    sourcePath={definition?.icon_path ?? ""}
                    alt={`${name}, ${t("field.level", { value: character.level })}, ${t("field.eidolon", { value: character.eidolon })}`}
                    rarity={definition?.rarity ?? null}
                    badge={character.eidolon}
                    level={`Lv. ${character.level}`}
                    cornerAsset={
                      combatType
                        ? {
                            kind: "combat-type",
                            id: combatType.id,
                            sourcePath: combatType.icon_path,
                            alt: combatTypeName(character.combatTypeId),
                          }
                        : undefined
                    }
                    size={iconSize}
                    tabIndex={0}
                    className="rounded-md outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-ring group-hover:scale-105"
                  />
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

function levelGroup(
  character: Character,
  definition: CharacterDefinition | undefined
): LevelGroup {
  const maxLevel =
    definition?.stat_scaling.at(-1)?.max_level ?? DEFAULT_CHARACTER_LEVEL;
  return character.level >= maxLevel ? "max" : "other";
}
