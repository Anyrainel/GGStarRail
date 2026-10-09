import { Filter, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { SelectField, ToggleField } from "@/components/builds/BuildControls";
import { BuildWorkspaceActions } from "@/components/builds/BuildWorkspaceActions";
import { RelicScoreCard } from "@/components/builds/RelicScoreCard";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import {
  BUILD_SLOT_ORDER,
  recommendBuildLoadout,
} from "@/domain/build/evaluation";
import {
  type BuildFilterMatch,
  deriveBuildFilters,
  evaluateBuildFilter,
} from "@/domain/build/filters";
import { scoreRelic } from "@/domain/build/scoring";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { buildDisplayName } from "@/lib/buildPresentation";
import { createRelicScoringContext } from "@/lib/buildReferences";
import {
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import type { RelicSlotId } from "@/providers/reference/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<(typeof BUILD_SLOT_ORDER)[number], RelicSlotId>;

export default function ArtifactBuildsView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const { data, error, loading } = useBuildReferences();
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedCavernId, setSelectedCavernId] = useState("");
  const [selectedPlanarId, setSelectedPlanarId] = useState("");
  const [selectedFilterId, setSelectedFilterId] = useState("");
  const [matchesOnly, setMatchesOnly] = useState(true);

  const characterIds = [
    ...new Set(builds.map((build) => build.characterDefinitionId)),
  ];
  const characterId = characterIds.includes(selectedCharacterId)
    ? selectedCharacterId
    : characterIds[0];
  const cavernBuilds = builds.filter(
    (build) =>
      build.characterDefinitionId === characterId && build.category === "cavern"
  );
  const planarBuilds = builds.filter(
    (build) =>
      build.characterDefinitionId === characterId && build.category === "planar"
  );
  const cavern =
    cavernBuilds.find(({ id }) => id === selectedCavernId) ?? cavernBuilds[0];
  const planar =
    planarBuilds.find(({ id }) => id === selectedPlanarId) ?? planarBuilds[0];
  const selectedBuilds = useMemo(
    () =>
      [cavern, planar].flatMap((build) => {
        const profile = profiles.find(
          (profile) => profile.id === build?.scoreProfileId
        );
        return build && profile ? [{ build, profile }] : [];
      }),
    [cavern, planar, profiles]
  );
  const scoringContext = useMemo(
    () => (data ? createRelicScoringContext(data) : null),
    [data]
  );
  const filters = useMemo(
    () =>
      selectedBuilds.flatMap(({ build, profile }) =>
        deriveBuildFilters(build, profile)
      ),
    [selectedBuilds]
  );
  const selectedFilter =
    filters.find((candidate) => candidate.id === selectedFilterId) ??
    filters[0] ??
    null;
  const selectedInput = selectedBuilds.find(
    ({ build }) => build.id === selectedFilter?.buildId
  );
  const build = selectedInput?.build;
  const profile = selectedInput?.profile;
  const evaluatedRelics = useMemo(() => {
    if (!account || !selectedFilter || !build || !profile || !scoringContext) {
      return [];
    }
    return account.relics
      .map((relic) => {
        const score = scoreRelic(relic, profile, scoringContext, build);
        return {
          relic,
          score,
          match: evaluateBuildFilter(relic, selectedFilter, score.total),
        };
      })
      .filter(({ match }) => !matchesOnly || match.matches)
      .sort(
        (left, right) =>
          Number(right.match.matches) - Number(left.match.matches) ||
          Number(right.match.structuralMatch) -
            Number(left.match.structuralMatch) ||
          right.score.total - left.score.total ||
          left.relic.key.localeCompare(right.relic.key)
      );
  }, [account, build, matchesOnly, profile, scoringContext, selectedFilter]);
  const allMatchCounts = useMemo(() => {
    if (!account || !scoringContext) return new Map();
    return new Map(
      filters.map((filter) => [
        filter.id,
        account.relics.filter((relic) => {
          const input = selectedBuilds.find(
            ({ build }) => build.id === filter.buildId
          )!;
          const score = scoreRelic(
            relic,
            input.profile,
            scoringContext,
            input.build
          );
          return evaluateBuildFilter(relic, filter, score.total).matches;
        }).length,
      ])
    );
  }, [account, selectedBuilds, filters, scoringContext]);
  const recommendation = useMemo(() => {
    if (!account || selectedBuilds.length === 0 || !scoringContext) return null;
    const parts = selectedBuilds.map(({ build, profile }) =>
      recommendBuildLoadout(account, build, profile, scoringContext)
    );
    const selected = Object.assign(
      {},
      ...parts.map((part) => part.selected)
    ) as (typeof parts)[number]["selected"];
    const missingSlots = BUILD_SLOT_ORDER.filter((slot) => !selected[slot]);
    const scores = Object.values(selected).map(({ score }) => score.total);
    return {
      selected,
      missingSlots,
      complete: missingSlots.length === 0,
      averageScore: scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null,
    };
  }, [account, selectedBuilds, scoringContext]);

  return (
    <ScrollLayout bodyClassName="space-y-4">
      <PageHeader titleKey="route.filters.title" visuallyHidden />
      <BuildWorkspaceActions references={data} />
      <SourceCoverageNotice account={account} />
      {loading ? (
        <CatalogLoading />
      ) : error || !data || !scoringContext ? (
        <CatalogLoadError error={error} />
      ) : builds.length === 0 ? (
        <EmptyState messageKey="filters.needsBuild" icon={Filter}>
          <Button asChild size="sm">
            <Link to={APP_PATHS.builds}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {t("filters.openBuilds")}
            </Link>
          </Button>
        </EmptyState>
      ) : !build || !profile ? (
        <EmptyState messageKey="filters.missingProfile" icon={Filter} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardContent className="grid gap-3 p-3 md:grid-cols-3">
              <SelectField
                label={t("filters.character")}
                value={characterId ?? ""}
                options={characterIds.map((id) => ({
                  value: id,
                  label: localizedName(
                    data.characters.byId.get(id)?.name,
                    locale,
                    id
                  ),
                }))}
                onChange={(id) => {
                  setSelectedCharacterId(id);
                  setSelectedCavernId("");
                  setSelectedPlanarId("");
                  setSelectedFilterId("");
                }}
              />
              <SelectField
                label={t("build.cavernCards")}
                value={cavern?.id ?? "none"}
                options={
                  cavernBuilds.length
                    ? cavernBuilds.map((build) => ({
                        value: build.id,
                        label: buildDisplayName(build, data, locale),
                      }))
                    : [{ value: "none", label: t("filters.noCategoryBuild") }]
                }
                onChange={(id) => {
                  setSelectedCavernId(id);
                  setSelectedFilterId("");
                }}
              />
              <SelectField
                label={t("build.planarCards")}
                value={planar?.id ?? "none"}
                options={
                  planarBuilds.length
                    ? planarBuilds.map((build) => ({
                        value: build.id,
                        label: buildDisplayName(build, data, locale),
                      }))
                    : [{ value: "none", label: t("filters.noCategoryBuild") }]
                }
                onChange={(id) => {
                  setSelectedPlanarId(id);
                  setSelectedFilterId("");
                }}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-select p-4">
              <CardTitle className="text-sm">
                {t("filters.rulesTitle")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("filters.rulesHelp")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {filters.map((filter) => {
                const slot = data.properties.relicSlotById.get(
                  DOMAIN_SLOT_TO_CATALOG[filter.slot]
                );
                const active = selectedFilter?.id === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "min-w-0 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-background/40 hover:bg-accent/50"
                    )}
                    onClick={() => setSelectedFilterId(filter.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {localizedName(slot?.name, locale, filter.slot)}
                      </span>
                      <Badge variant={active ? "secondary" : "outline"}>
                        {t("filters.matchCount", {
                          count: allMatchCounts.get(filter.id) ?? 0,
                        })}
                      </Badge>
                    </div>
                    <FilterSummary filter={filter} data={data} />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {recommendation && (
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-gradient-select p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">
                      {t("filters.recommendationTitle")}
                    </CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        recommendation.complete ? "secondary" : "outline"
                      }
                    >
                      {recommendation.complete
                        ? t("filters.loadoutComplete")
                        : t("filters.loadoutMissing", {
                            count: recommendation.missingSlots.length,
                          })}
                    </Badge>
                    <Badge className="tabular-nums">
                      {t("scoring.average", {
                        value: recommendation.averageScore?.toFixed(1) ?? "—",
                      })}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {BUILD_SLOT_ORDER.map((slotId) => {
                  const selected = recommendation.selected[slotId];
                  if (selected) {
                    return (
                      <RelicScoreCard
                        key={slotId}
                        relic={selected.relic}
                        score={selected.score}
                        references={data}
                        locale={locale}
                        selected
                      />
                    );
                  }
                  const slot = data.properties.relicSlotById.get(
                    DOMAIN_SLOT_TO_CATALOG[slotId]
                  );
                  return (
                    <div
                      key={slotId}
                      className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border bg-background/30 p-4 text-center text-sm text-muted-foreground"
                    >
                      {t("filters.noCandidate", {
                        slot: localizedName(slot?.name, locale, slotId),
                      })}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {!account ? (
            <WorkspaceStartState
              messageKey="filters.needsAccount"
              icon={Sparkles}
            />
          ) : selectedFilter ? (
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-gradient-select p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-sm">
                      {t("filters.inventoryTitle")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t("filters.inventoryHelp")}
                    </CardDescription>
                  </div>
                  <ToggleField
                    label={t("filters.matchesOnly")}
                    checked={matchesOnly}
                    onChange={setMatchesOnly}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {evaluatedRelics.slice(0, 18).map(({ relic, score, match }) => (
                  <RelicScoreCard
                    key={relic.key}
                    relic={relic}
                    score={score}
                    references={data}
                    locale={locale}
                    selected={match.matches}
                  >
                    <MatchReasons match={match} />
                  </RelicScoreCard>
                ))}
                {evaluatedRelics.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("filters.noMatches")}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </ScrollLayout>
  );
}

function FilterSummary({
  filter,
  data,
}: {
  filter: ReturnType<typeof deriveBuildFilters>[number];
  data: NonNullable<ReturnType<typeof useBuildReferences>["data"]>;
}) {
  const { locale, t } = useI18n();
  const propertyName = (propertyId: string) =>
    localizedPropertyName(propertyId, data.properties, locale);
  return (
    <dl className="mt-3 space-y-2 text-xs">
      <div>
        <dt className="text-muted-foreground">{t("filters.sets")}</dt>
        <dd className="mt-0.5 line-clamp-2">
          {filter.setIds
            .map((setId) =>
              localizedName(data.relicSets.byId.get(setId)?.name, locale, setId)
            )
            .join(" + ")}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("filters.mainStats")}</dt>
        <dd className="mt-0.5 line-clamp-2">
          {filter.mainStatIds.map(propertyName).join(" / ")}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("filters.weightedStats")}</dt>
        <dd className="mt-0.5 line-clamp-2">
          {filter.weightedStatIds.length > 0
            ? filter.weightedStatIds.map(propertyName).join(" · ")
            : t("filters.noneRequired")}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("filters.mustHaveStats")}</dt>
        <dd className="mt-0.5 line-clamp-2">
          {filter.mustHaveStatIds.length > 0
            ? filter.mustHaveStatIds.map(propertyName).join(" · ")
            : t("filters.noneRequired")}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">{t("filters.desiredStats")}</dt>
        <dd className="font-medium tabular-nums">
          {t("filters.minimumStats", {
            count: filter.minimumDesiredStats,
          })}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">{t("filters.minimumScore")}</dt>
        <dd className="font-medium tabular-nums">{filter.minimumScore}</dd>
      </div>
    </dl>
  );
}

function MatchReasons({ match }: { match: BuildFilterMatch }) {
  const { t } = useI18n();
  const passedLabel = (reason: BuildFilterMatch["reasons"][number]) => {
    switch (reason) {
      case "slot":
        return t("filters.reason.slot");
      case "set":
        return t("filters.reason.set");
      case "main-stat":
        return t("filters.reason.mainStat");
      case "weighted-substats":
        return t("filters.reason.substats");
      case "minimum-score":
        return t("filters.reason.score");
    }
  };
  const failedLabel = (reason: BuildFilterMatch["reasons"][number]) => {
    switch (reason) {
      case "slot":
        return t("filters.reason.slotMissing");
      case "set":
        return t("filters.reason.setMissing");
      case "main-stat":
        return t("filters.reason.mainStatMissing");
      case "weighted-substats":
        return t("filters.reason.substatsMissing");
      case "minimum-score":
        return t("filters.reason.scoreMissing");
    }
  };
  const criteria = [
    "slot",
    "set",
    "main-stat",
    "weighted-substats",
    "minimum-score",
  ] as const satisfies BuildFilterMatch["reasons"];
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={match.matches ? "secondary" : "outline"}>
        {match.matches ? t("filters.matches") : t("filters.doesNotMatch")}
      </Badge>
      {criteria.map((reason) => {
        const passed = match.reasons.includes(reason);
        return (
          <Badge key={reason} variant={passed ? "secondary" : "outline"}>
            {passed ? passedLabel(reason) : failedLabel(reason)}
          </Badge>
        );
      })}
    </div>
  );
}
