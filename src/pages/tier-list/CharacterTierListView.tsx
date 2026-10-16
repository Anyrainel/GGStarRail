import { ToggleGroup } from "radix-ui";
import { useMemo } from "react";
import { TierCatalogState } from "@/components/tier-list/TierCatalogState";
import { TierTable } from "@/components/tier-list/TierTable";
import type {
  TierGroupConfig,
  TierItemData,
} from "@/components/tier-list/tierTableTypes";
import { characterAppearanceId } from "@/domain/characterIdentity";
import { useCharacterReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/game/text";
import {
  characterCatalogName,
  localizedName,
} from "@/services/catalog/presentation";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useTrailblazerAppearanceStore } from "@/stores/useTrailblazerAppearanceStore";

export default function CharacterTierListView() {
  const { locale, t } = useI18n();
  const { data, error, loading } = useCharacterReferences();
  const { appearance, setAppearance } = useTrailblazerAppearanceStore();
  const assignments = useCharacterPriorityStore((state) => state.assignments);
  const setPriorityState = useCharacterPriorityStore(
    (state) => state.setPriorityState
  );

  const groups = useMemo<readonly TierGroupConfig<string>[]>(
    () =>
      (data?.properties.combatTypes ?? []).map((combatType) => ({
        id: combatType.id,
        name: formatGameText(
          localizedName(combatType.name, locale, combatType.id)
        ),
        asset: {
          kind: "combat-type" as const,
          id: combatType.id,
          sourcePath: combatType.icon_path,
        },
      })),
    [data, locale]
  );
  const items = useMemo<readonly TierItemData<string>[]>(
    () =>
      [...(data?.characters.identities ?? [])]
        .map((character) => ({
          kind: "character" as const,
          id: character.id,
          appearanceId: characterAppearanceId(character.id, appearance),
          sourcePath: character.icon_path,
          name: characterCatalogName(
            data?.characters.byId.get(
              characterAppearanceId(character.id, appearance)
            ) ?? character,
            locale,
            t("terms.trailblazer")
          ),
          rarity: character.rarity,
          group: character.combat_type_id,
        }))
        .sort(
          (left, right) =>
            right.rarity - left.rarity ||
            left.name.localeCompare(right.name, locale)
        ),
    [data, locale, t, appearance]
  );

  if (loading || error || !data) {
    return (
      <TierCatalogState category="character" loading={loading} error={error} />
    );
  }

  return (
    <TierTable
      extraFilters={
        <ToggleGroup.Root
          type="single"
          value={appearance}
          onValueChange={(value) => {
            if (value === "caelus" || value === "stelle") setAppearance(value);
          }}
          aria-label={t("tier.trailblazerAppearance")}
          className="inline-flex shrink-0"
        >
          {(["caelus", "stelle"] as const).map((value) => (
            <ToggleGroup.Item
              key={value}
              value={value}
              className="inline-flex h-7 items-center justify-center border border-border px-3 text-sm font-medium text-muted-foreground outline-hidden transition-colors first:rounded-l-sm last:-ml-px last:rounded-r-sm hover:bg-accent hover:text-accent-foreground focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {value === "caelus" ? t("terms.caelus") : t("terms.stelle")}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      }
      items={items}
      groups={groups}
      assignments={assignments}
      onChange={setPriorityState}
    />
  );
}
