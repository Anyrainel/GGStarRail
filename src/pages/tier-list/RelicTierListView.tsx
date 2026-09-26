import { Gem, Orbit } from "lucide-react";
import { useMemo } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { TierTable } from "@/components/tier-list/TierTable";
import type {
  TierGroupConfig,
  TierItemData,
} from "@/components/tier-list/tierTableTypes";
import { useRelicReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { createRelicSetRarityMap } from "@/lib/relicRarity";
import { useRelicPriorityStore } from "@/stores/useRelicPriorityStore";

type RelicKind = "cavern_relic" | "planar_ornament";

export default function RelicTierListView() {
  const { locale, t } = useI18n();
  const { data, error, loading } = useRelicReferences();
  const assignments = useRelicPriorityStore((state) => state.assignments);
  // Keep legacy role metadata round-trippable; columns use catalog kinds only.
  const groupAssignments = useRelicPriorityStore(
    (state) => state.groupAssignments
  );
  const setPriorityState = useRelicPriorityStore(
    (state) => state.setPriorityState
  );

  const groups = useMemo<readonly TierGroupConfig<RelicKind>[]>(
    () => [
      {
        id: "cavern_relic",
        name: t("archive.kind.cavern"),
        icon: <Gem className="h-5 w-5 text-primary" aria-hidden="true" />,
      },
      {
        id: "planar_ornament",
        name: t("archive.kind.planar"),
        icon: <Orbit className="h-5 w-5 text-primary" aria-hidden="true" />,
      },
    ],
    [t]
  );
  const items = useMemo<readonly TierItemData<RelicKind>[]>(() => {
    const rarityBySet = createRelicSetRarityMap(data?.relicPieces.values ?? []);
    return [...(data?.relicSets.values ?? [])]
      .map((relicSet) => ({
        kind: "relic-set" as const,
        id: relicSet.id,
        sourcePath: relicSet.icon_path,
        name: formatGameText(localizedName(relicSet.name, locale, relicSet.id)),
        rarity: rarityBySet.get(relicSet.id) ?? null,
        group: relicSet.kind,
        detail: relicSet.kind,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, locale));
  }, [data, locale]);
  return (
    <>
      {loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <TierTable
          items={items}
          groups={groups}
          assignments={assignments}
          groupAssignments={groupAssignments}
          onChange={setPriorityState}
        />
      )}
    </>
  );
}
