import { useMemo } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { FilterChip } from "@/components/shared/FilterChip";
import { TierTable } from "@/components/tier-list/TierTable";
import type {
  TierGroupConfig,
  TierItemData,
} from "@/components/tier-list/tierTableTypes";
import { characterAppearanceId } from "@/domain/characterIdentity";
import { useCharacterReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { characterCatalogName, localizedName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
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

  return (
    <>
      {loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <TierTable
          extraFilters={
            <fieldset
              aria-label={t("tier.trailblazerAppearance")}
              className="flex items-center gap-1"
            >
              {(["caelus", "stelle"] as const).map((value) => (
                <FilterChip
                  key={value}
                  active={appearance === value}
                  onClick={() => setAppearance(value)}
                >
                  {value === "caelus" ? t("terms.caelus") : t("terms.stelle")}
                </FilterChip>
              ))}
            </fieldset>
          }
          items={items}
          groups={groups}
          assignments={assignments}
          onChange={setPriorityState}
        />
      )}
    </>
  );
}
