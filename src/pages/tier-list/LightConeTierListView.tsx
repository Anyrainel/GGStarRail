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
import { useLightConeReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { useLightConePriorityStore } from "@/stores/useLightConePriorityStore";

export default function LightConeTierListView() {
  const { locale } = useI18n();
  const { data, error, loading } = useLightConeReferences();
  const assignments = useLightConePriorityStore((state) => state.assignments);
  const setPriorityState = useLightConePriorityStore(
    (state) => state.setPriorityState
  );
  const resetPriorities = useLightConePriorityStore(
    (state) => state.resetPriorities
  );

  const groups = useMemo<readonly TierGroupConfig<string>[]>(
    () =>
      (data?.properties.paths ?? []).map((path) => ({
        id: path.id,
        name: formatGameText(localizedName(path.name, locale, path.id)),
        asset: {
          kind: "path" as const,
          id: path.id,
          sourcePath: path.icon_path,
        },
      })),
    [data, locale]
  );
  const items = useMemo<readonly TierItemData<string>[]>(
    () =>
      [...(data?.lightCones.values ?? [])]
        .map((lightCone) => ({
          kind: "light-cone" as const,
          id: lightCone.id,
          sourcePath: lightCone.icon_path,
          name: formatGameText(
            localizedName(lightCone.name, locale, lightCone.id)
          ),
          rarity: lightCone.rarity,
          group: lightCone.path_id,
        }))
        .sort(
          (left, right) =>
            right.rarity - left.rarity ||
            left.name.localeCompare(right.name, locale)
        ),
    [data, locale]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        titleKey="route.tierLightCones.title"
        descriptionKey="route.tierLightCones.description"
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
