import { HeartHandshake, Shapes, Sword } from "lucide-react";
import { useMemo, useState } from "react";
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
import type { RelicPriorityGroup } from "@/domain/tier-list/types";
import { useRelicReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { createRelicSetRarityMap } from "@/lib/relicRarity";
import { useRelicPriorityStore } from "@/stores/useRelicPriorityStore";

type RelicKindFilter = "all" | "cavern_relic" | "planar_ornament";

export default function RelicTierListView() {
  const { locale, t } = useI18n();
  const { data, error, loading } = useRelicReferences();
  const assignments = useRelicPriorityStore((state) => state.assignments);
  const groupAssignments = useRelicPriorityStore(
    (state) => state.groupAssignments
  );
  const setPriorityState = useRelicPriorityStore(
    (state) => state.setPriorityState
  );

  const [kind, setKind] = useState<RelicKindFilter>("all");

  const groups = useMemo<readonly TierGroupConfig<RelicPriorityGroup>[]>(
    () => [
      {
        id: "dps",
        name: t("tier.priority.role.dps"),
        icon: <Sword className="h-5 w-5 text-primary" aria-hidden="true" />,
      },
      {
        id: "support",
        name: t("tier.priority.role.support"),
        icon: (
          <HeartHandshake className="h-5 w-5 text-primary" aria-hidden="true" />
        ),
      },
      {
        id: "other",
        name: t("tier.priority.role.other"),
        icon: <Shapes className="h-5 w-5 text-primary" aria-hidden="true" />,
      },
    ],
    [t]
  );
  const items = useMemo<readonly TierItemData<RelicPriorityGroup>[]>(() => {
    const rarityBySet = createRelicSetRarityMap(data?.relicPieces.values ?? []);
    return [...(data?.relicSets.values ?? [])]
      .map((relicSet) => ({
        kind: "relic-set" as const,
        id: relicSet.id,
        sourcePath: relicSet.icon_path,
        name: formatGameText(localizedName(relicSet.name, locale, relicSet.id)),
        rarity: rarityBySet.get(relicSet.id) ?? null,
        group: "other" as const,
        detail: relicSet.kind,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, locale));
  }, [data, locale]);
  const filters: readonly [RelicKindFilter, string][] = [
    ["all", t("filter.allKinds")],
    ["cavern_relic", t("archive.kind.cavern")],
    ["planar_ornament", t("archive.kind.planar")],
  ];

  return (
    <>
      {loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <TierTable
          extraFilters={
            <div className="flex flex-wrap gap-1.5">
              {filters.map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={kind === value}
                  onClick={() => setKind(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          }
          items={items}
          groups={groups}
          assignments={assignments}
          groupAssignments={groupAssignments}
          allowGroupChange
          filterItem={(item) => kind === "all" || item.detail === kind}
          onChange={setPriorityState}
        />
      )}
    </>
  );
}
