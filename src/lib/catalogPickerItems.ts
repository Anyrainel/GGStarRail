import type { PickerFilter, PickerItem } from "@/components/shared/ItemPicker";
import type { Locale } from "@/i18n/locales";
import type { BuildReferences } from "./buildReferences";
import {
  characterCatalogName,
  localizedName,
  localizedSearchText,
} from "./catalogPresentation";
import { createRelicSetRarityMap } from "./relicRarity";

export function catalogPickerItems(
  kind: "character" | "light-cone" | "relic-set",
  references: BuildReferences,
  locale: Locale,
  trailblazer: string
): PickerItem[] {
  const rarityMap =
    kind === "relic-set"
      ? createRelicSetRarityMap(references.relicPieces.values)
      : new Map<string, number>();
  const source =
    kind === "character"
      ? references.characters.values
      : kind === "light-cone"
        ? references.lightCones.values
        : references.relicSets.values;
  return source
    .map((item) => {
      const path =
        "path_id" in item
          ? references.properties.pathById.get(item.path_id)
          : undefined;
      const combatType =
        "combat_type_id" in item
          ? references.properties.combatTypeById.get(item.combat_type_id)
          : undefined;
      const rarity =
        "rarity" in item ? item.rarity : (rarityMap.get(item.id) ?? null);
      return {
        id: item.id,
        name:
          "combat_type_id" in item
            ? characterCatalogName(item, locale, trailblazer)
            : localizedName(item.name, locale, item.id),
        searchText: localizedSearchText(item.name, item.id),
        iconPath: item.icon_path,
        rarity,
        tags: [
          String(rarity),
          ...("kind" in item ? [item.kind] : []),
          ...(path ? [path.id] : []),
          ...(combatType ? [combatType.id] : []),
        ],
        cornerAsset: combatType
          ? {
              kind: "combat-type" as const,
              id: combatType.id,
              sourcePath: combatType.icon_path,
              alt: localizedName(combatType.name, locale, combatType.id),
            }
          : path
            ? {
                kind: "path" as const,
                id: path.id,
                sourcePath: path.icon_path,
                alt: localizedName(path.name, locale, path.id),
              }
            : undefined,
      };
    })
    .sort(
      (a, b) =>
        (b.rarity ?? 0) - (a.rarity ?? 0) ||
        a.name.localeCompare(b.name, locale)
    );
}

export function rarityPickerFilter(
  items: readonly PickerItem[],
  label: string
): PickerFilter {
  return {
    id: "rarity",
    label,
    options: [
      ...new Set(
        items.flatMap((item) => (item.rarity === null ? [] : [item.rarity]))
      ),
    ]
      .sort((a, b) => b - a)
      .map((rarity) => ({ id: String(rarity), label: `★ ${rarity}` })),
  };
}
