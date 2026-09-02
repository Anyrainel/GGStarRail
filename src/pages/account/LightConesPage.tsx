import { WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountCoverageNotice } from "@/components/account/AccountCoverageNotice";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { InventoryToolbar } from "@/components/account/InventoryToolbar";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { AssetImage } from "@/components/shared/AssetImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLightConeReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedSearchText } from "@/lib/catalogPresentation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

type EquipmentStatus =
  | "all"
  | "locked"
  | "unlocked"
  | "unknown-lock"
  | "equipped"
  | "unequipped";

export default function LightConesPage() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const lightCones = account?.lightCones ?? [];
  const { data, error, loading } = useLightConeReferences();
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [status, setStatus] = useState<EquipmentStatus>("all");

  const visibleLightCones = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return lightCones
      .filter((lightCone) => pathId === "all" || lightCone.pathId === pathId)
      .filter((lightCone) => {
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
          default:
            return true;
        }
      })
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

  return (
    <>
      <PageHeader
        titleKey="route.lightCones.title"
        descriptionKey="route.lightCones.description"
      />
      <AccountCoverageNotice account={account} />
      {lightCones.length === 0 ? (
        account ? (
          <EmptyState messageKey="empty.lightCones" icon={WandSparkles} />
        ) : (
          <WorkspaceStartState
            messageKey="empty.lightCones"
            icon={WandSparkles}
          />
        )
      ) : loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <>
          <InventoryToolbar
            query={query}
            searchLabel={t("common.search")}
            searchPlaceholder={t("search.lightCones")}
            countLabel={t("common.count", {
              count: visibleLightCones.length,
            })}
            onQueryChange={setQuery}
            filters={[
              {
                id: "path",
                label: t("filter.path"),
                value: pathId,
                options: pathOptions,
                onChange: setPathId,
              },
              {
                id: "status",
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
                onChange: (value) => setStatus(value as EquipmentStatus),
              },
            ]}
          />
          {visibleLightCones.length === 0 ? (
            <EmptyState messageKey="empty.filtered" icon={WandSparkles} />
          ) : (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleLightCones.map((lightCone) => {
                const definition = data.lightCones.byId.get(
                  lightCone.definitionId
                );
                const name = localizedName(
                  definition?.name,
                  locale,
                  lightCone.definitionId
                );
                const path = data.properties.pathById.get(lightCone.pathId);
                return (
                  <Card key={lightCone.key} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                      <AssetImage
                        kind="light-cone"
                        id={definition?.id ?? lightCone.definitionId}
                        sourcePath={definition?.icon_path ?? ""}
                        alt={name}
                        className="h-20 w-16 shrink-0 rounded-lg bg-background/70 object-contain"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <CardTitle className="line-clamp-2 text-base leading-5">
                          {name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          {definition && (
                            <Badge variant="secondary">
                              {t("field.rarity", {
                                value: definition.rarity,
                              })}
                            </Badge>
                          )}
                          <Badge>
                            {t("field.level", { value: lightCone.level })}
                          </Badge>
                          <Badge variant="outline">
                            {t("field.superimposition", {
                              value: lightCone.superimposition,
                            })}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm text-muted-foreground">
                      <p>
                        {t("field.path", {
                          value: localizedName(
                            path?.name,
                            locale,
                            lightCone.pathId
                          ),
                        })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {lightCone.locked === true && (
                          <Badge variant="outline">{t("field.locked")}</Badge>
                        )}
                        {lightCone.locked === null && (
                          <Badge variant="outline">
                            {t("field.lockUnknown")}
                          </Badge>
                        )}
                        {lightCone.equippedCharacterKey && (
                          <Badge variant="outline">{t("field.equipped")}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
        </>
      )}
    </>
  );
}
