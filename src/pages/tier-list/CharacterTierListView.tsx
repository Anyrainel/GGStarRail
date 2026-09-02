import { useMemo } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PriorityWorkspaceHeader } from "@/components/tier-list/PriorityWorkspaceHeader";
import { TierTable } from "@/components/tier-list/TierTable";
import type {
  TierGroupConfig,
  TierItemData,
} from "@/components/tier-list/tierTableTypes";
import { useCharacterReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { characterCatalogName, localizedName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";

export default function CharacterTierListView() {
  const { locale, t } = useI18n();
  const { data, error, loading } = useCharacterReferences();
  const assignments = useCharacterPriorityStore((state) => state.assignments);
  const setPriorityState = useCharacterPriorityStore(
    (state) => state.setPriorityState
  );
  const resetPriorities = useCharacterPriorityStore(
    (state) => state.resetPriorities
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
      [...(data?.characters.values ?? [])]
        .map((character) => ({
          kind: "character" as const,
          id: character.id,
          sourcePath: character.icon_path,
          name: characterCatalogName(character, locale, t("terms.trailblazer")),
          rarity: character.rarity,
          group: character.combat_type_id,
        }))
        .sort(
          (left, right) =>
            right.rarity - left.rarity ||
            left.name.localeCompare(right.name, locale)
        ),
    [data, locale, t]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        titleKey="route.tierCharacters.title"
        descriptionKey="route.tierCharacters.description"
        visuallyHidden
      />
      <PriorityWorkspaceHeader
        assignedCount={Object.keys(assignments).length}
        totalCount={items.length}
        onReset={resetPriorities}
      />
      {loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <TierTable
          items={items}
          groups={groups}
          assignments={assignments}
          onChange={setPriorityState}
        />
      )}
    </div>
  );
}
