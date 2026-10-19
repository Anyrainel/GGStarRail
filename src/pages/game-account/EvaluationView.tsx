import { ClipboardCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
import { WorkspaceStartState } from "@/components/game-account/imports/WorkspaceStartState";
import { AccountSourceBadge } from "@/components/game-account/planning/AccountSourceBadge";
import { BuildCompletionCard } from "@/components/game-account/planning/BuildCompletionCard";
import {
  type ResourceSetGroup,
  ResourceSetStrip,
} from "@/components/game-account/planning/ResourceSetStrip";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import { FilterChip } from "@/components/shared/FilterChip";
import { HelpButton } from "@/components/shared/HelpButton";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { evaluateAccountCompletion } from "@/domain/build/completion";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { createRelicScoringContext } from "@/services/catalog/buildReferences";
import {
  characterCatalogName,
  localizedName,
} from "@/services/catalog/presentation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function EvaluationView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const { data, loading, error } = useBuildReferences();
  const [params, setParams] = useSearchParams();
  const selectedCharacterId = params.get("character");
  const selectedBuildId = params.get("build");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [gapsOnly, setGapsOnly] = useState(false);
  const evaluations = useMemo(
    () =>
      account && data
        ? evaluateAccountCompletion(
            account,
            builds,
            profiles,
            createRelicScoringContext(data)
          )
        : [],
    [account, builds, data, profiles]
  );
  const characters = useMemo(
    () =>
      [
        ...new Set(
          evaluations.map((entry) => entry.build.characterDefinitionId)
        ),
      ]
        .map((id) => {
          const character = data?.characters.byId.get(id);
          return {
            id,
            name: character
              ? characterCatalogName(character, locale, t("terms.trailblazer"))
              : id,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name, locale)),
    [data, evaluations, locale, t]
  );
  const characterFiltered = evaluations.filter(
    (entry) =>
      (!selectedCharacterId ||
        entry.build.characterDefinitionId === selectedCharacterId) &&
      (!selectedBuildId || entry.build.id === selectedBuildId)
  );
  const setGroups: ResourceSetGroup[] = ["cavern", "planar"].map((kind) => {
    const counts = new Map<string, number>();
    for (const entry of characterFiltered.filter(
      (entry) => entry.build.category === kind
    )) {
      for (const id of new Set(entry.slots.map((slot) => slot.setId)))
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return {
      kind: kind === "cavern" ? "cavern" : "planar",
      sets: [...counts].map(([setId, count]) => {
        const set = data?.relicSets.byId.get(setId);
        return {
          setId,
          count,
          name: localizedName(set?.name, locale, setId),
          iconPath: set?.icon_path ?? "",
        };
      }),
    };
  });
  const visible = characterFiltered.filter(
    (entry) =>
      (!selectedSetId ||
        entry.slots.some((slot) => slot.setId === selectedSetId)) &&
      (!gapsOnly || entry.readyCount < entry.slots.length)
  );
  const start = !account
    ? builds.length === 0
      ? ({ messageKey: "evaluation.needsBoth", requires: "both" } as const)
      : ({
          messageKey: "evaluation.needsAccount",
          requires: "account",
        } as const)
    : builds.length === 0
      ? ({ messageKey: "evaluation.needsBuild", requires: "builds" } as const)
      : null;
  if (start || loading || error || !account || !data)
    return (
      <PageLayout>
        <PageHeader titleKey="route.evaluation.title" visuallyHidden />
        <ScrollLayout>
          {start ? (
            <WorkspaceStartState {...start} icon={ClipboardCheck} />
          ) : loading ? (
            <CatalogLoading />
          ) : (
            <CatalogLoadError error={error} />
          )}
        </ScrollLayout>
      </PageLayout>
    );
  return (
    <PageLayout>
      <ScrollLayout
        bodyClassName="space-y-4"
        header={
          <div className="space-y-3">
            <PageHeader titleKey="route.evaluation.title">
              <AccountSourceBadge account={account} />
              <HelpButton title={t("route.evaluation.title")}>
                <p>{t("evaluation.inventoryBoundary")}</p>
                <p>{t("evaluation.potentialRule")}</p>
                <p>{t("evaluation.readyRule")}</p>
              </HelpButton>
            </PageHeader>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                {t("evaluation.characterFilter")}
                <LightweightSelect
                  value={selectedCharacterId ?? "all"}
                  onValueChange={(value) => {
                    const next = new URLSearchParams(params);
                    next.delete("build");
                    if (value !== "all") next.set("character", value);
                    else next.delete("character");
                    setParams(next);
                    setSelectedSetId(null);
                  }}
                >
                  <LightweightSelectTrigger
                    aria-label={t("evaluation.characterFilter")}
                    className="max-w-52"
                  >
                    <LightweightSelectValue />
                  </LightweightSelectTrigger>
                  <LightweightSelectContent>
                    <LightweightSelectItem value="all">
                      {t("common.all")}
                    </LightweightSelectItem>
                    {characters.map((character) => (
                      <LightweightSelectItem
                        key={character.id}
                        value={character.id}
                      >
                        {character.name}
                      </LightweightSelectItem>
                    ))}
                  </LightweightSelectContent>
                </LightweightSelect>
              </div>
              <FilterChip
                active={gapsOnly}
                onClick={() => setGapsOnly((current) => !current)}
              >
                {t("evaluation.gapsOnly")}
              </FilterChip>
              <span className="text-sm text-muted-foreground">
                {t("evaluation.buildCount", { count: visible.length })}
              </span>
            </div>
            {setGroups.some((group) => group.sets.length > 0) && (
              <ResourceSetStrip
                label={t("evaluation.setFilter")}
                groups={setGroups}
                value={selectedSetId}
                onChange={setSelectedSetId}
              />
            )}
          </div>
        }
      >
        <SourceCoverageNotice account={account} />
        {visible.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("evaluation.empty")}
          </p>
        ) : (
          visible.map((completion) => (
            <BuildCompletionCard
              key={completion.build.id}
              completion={completion}
              references={data}
              account={account}
            />
          ))
        )}
      </ScrollLayout>
    </PageLayout>
  );
}
