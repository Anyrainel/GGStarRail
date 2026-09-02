import { WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { InventoryToolbar } from "@/components/account/InventoryToolbar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { LightCone } from "@/domain/account/schemas";
import { useLightConeReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedSearchText } from "@/lib/catalogPresentation";

type LightConeStatus =
  | "all"
  | "locked"
  | "unlocked"
  | "unknown-lock"
  | "equipped"
  | "unequipped";

interface InventoryLightConeSectionProps {
  lightCones: readonly LightCone[];
}

export function InventoryLightConeSection({
  lightCones,
}: InventoryLightConeSectionProps) {
  const { locale, t } = useI18n();
  const { data, error, loading } = useLightConeReferences();
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [status, setStatus] = useState<LightConeStatus>("all");

  const visibleLightCones = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return lightCones
      .filter((lightCone) => pathId === "all" || lightCone.pathId === pathId)
      .filter((lightCone) => matchesStatus(lightCone, status))
      .filter((lightCone) => {
        if (!normalizedQuery) return true;
        const definition = data?.lightCones.byId.get(lightCone.definitionId);
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
  }, [data, lightCones, locale, pathId, query, status]);

  const pathOptions = useMemo(
    () => [
      { value: "all", label: t("filter.allPaths") },
      ...Array.from(new Set(lightCones.map((lightCone) => lightCone.pathId)))
        .map((id) => ({
          value: id,
          label: localizedName(
            data?.properties.pathById.get(id)?.name,
            locale,
            id
          ),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    ],
    [data, lightCones, locale, t]
  );

  if (lightCones.length === 0) {
    return <EmptyState messageKey="empty.lightCones" icon={WandSparkles} />;
  }
  if (loading) return <CatalogLoading />;
  if (error || !data) return <CatalogLoadError error={error} />;

  return (
    <div className="space-y-3">
      <InventoryToolbar
        query={query}
        searchLabel={t("common.search")}
        searchPlaceholder={t("search.lightCones")}
        countLabel={
          visibleLightCones.length === 1
            ? t("common.oneRecord")
            : t("common.count", { count: visibleLightCones.length })
        }
        onQueryChange={setQuery}
        filters={[
          {
            id: "inventory-light-cone-path",
            label: t("filter.path"),
            value: pathId,
            options: pathOptions,
            onChange: setPathId,
          },
          {
            id: "inventory-light-cone-status",
            label: t("filter.status"),
            value: status,
            options: [
              { value: "all", label: t("filter.allStatuses") },
              { value: "locked", label: t("filter.locked") },
              { value: "unlocked", label: t("filter.unlocked") },
              { value: "unknown-lock", label: t("filter.unknownLock") },
              { value: "equipped", label: t("filter.equipped") },
              { value: "unequipped", label: t("filter.unequipped") },
            ],
            onChange: (value) => setStatus(value as LightConeStatus),
          },
        ]}
      />
      {visibleLightCones.length === 0 ? (
        <EmptyState messageKey="empty.filtered" icon={WandSparkles} />
      ) : (
        <section
          className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3"
          aria-label={t("inventory.lightConesList")}
        >
          {visibleLightCones.map((lightCone) => {
            const definition = data.lightCones.byId.get(lightCone.definitionId);
            const name = localizedName(
              definition?.name,
              locale,
              lightCone.definitionId
            );
            const path = data.properties.pathById.get(lightCone.pathId);
            return (
              <Card key={lightCone.key} className="overflow-hidden">
                <CardContent className="flex items-center gap-3 p-3">
                  <ItemIcon
                    kind="light-cone"
                    id={definition?.id ?? lightCone.definitionId}
                    sourcePath={definition?.icon_path ?? ""}
                    alt={`${name}, ${t("field.level", { value: lightCone.level })}, ${t("field.superimposition", { value: lightCone.superimposition })}`}
                    rarity={definition?.rarity ?? null}
                    badge={lightCone.superimposition}
                    level={`Lv. ${lightCone.level}`}
                    locked={lightCone.locked}
                    size="md"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="line-clamp-2 text-sm font-semibold leading-5">
                      {name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {localizedName(path?.name, locale, lightCone.pathId)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {lightCone.equippedCharacterKey && (
                        <Badge variant="outline">{t("field.equipped")}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}

function matchesStatus(lightCone: LightCone, status: LightConeStatus): boolean {
  switch (status) {
    case "locked":
      return lightCone.locked === true;
    case "unlocked":
      return lightCone.locked === false;
    case "unknown-lock":
      return lightCone.locked === null;
    case "equipped":
      return lightCone.equippedCharacterKey !== undefined;
    case "unequipped":
      return lightCone.equippedCharacterKey === undefined;
    case "all":
      return true;
  }
}
