import { Filter, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountImportAction } from "@/components/account/AccountImportAction";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { FilterSetCard } from "@/components/builds/filters/FilterSetCard";
import {
  type LoadoutRecommendation,
  MatchSummary,
  RecommendedLoadoutCard,
} from "@/components/builds/filters/RelicFilterResults";
import {
  type FilterCharacterOption,
  RelicFilterSidebar,
} from "@/components/builds/filters/RelicFilterSidebar";
import { RelicScoreCard } from "@/components/builds/RelicScoreCard";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BUILD_SLOT_ORDER,
  recommendBuildLoadout,
} from "@/domain/build/evaluation";
import {
  deriveBuildFilters,
  evaluateBuildFilter,
} from "@/domain/build/filters";
import { scoreRelic } from "@/domain/build/scoring";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { buildDisplayName } from "@/lib/buildPresentation";
import { createRelicScoringContext } from "@/lib/buildReferences";
import { catalogPickerItems } from "@/lib/catalogPickerItems";
import {
  characterCatalogPresentation,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const CANDIDATE_LIMIT = 18;

export default function RelicFiltersView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const { data, error, loading } = useBuildReferences();
  const compact = useMediaQuery("(max-width: 767px)");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedCavernId, setSelectedCavernId] = useState("");
  const [selectedPlanarId, setSelectedPlanarId] = useState("");
  const [selectedFilterId, setSelectedFilterId] = useState("");
  const [matchesOnly, setMatchesOnly] = useState(true);

  const characterIds = useMemo(
    () => [...new Set(builds.map((build) => build.characterDefinitionId))],
    [builds]
  );
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
  const setsById = useMemo(
    () =>
      new Map(
        (data
          ? catalogPickerItems(
              "relic-set",
              data,
              locale,
              t("terms.trailblazer")
            )
          : []
        ).map((item) => [item.id, item])
      ),
    [data, locale, t]
  );
  const characterOptions = useMemo<FilterCharacterOption[]>(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const build of builds)
      counts.set(
        build.characterDefinitionId,
        (counts.get(build.characterDefinitionId) ?? 0) + 1
      );
    return characterIds.flatMap((id) => {
      const character = data.characters.byId.get(id);
      if (!character) return [];
      const name = characterCatalogPresentation(
        character,
        data.properties,
        locale,
        t("terms.trailblazer")
      ).name;
      return [
        {
          id,
          name,
          searchText:
            `${name} ${localizedSearchText(character.name, id)}`.toLocaleLowerCase(),
          iconPath: character.icon_path,
          rarity: character.rarity,
          buildCount: counts.get(id) ?? 0,
        },
      ];
    });
  }, [builds, characterIds, data, locale, t]);
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
  const matchCounts = useMemo(() => {
    if (!account || !scoringContext) return null;
    return new Map(
      filters.map((filter) => {
        const input = selectedBuilds.find(
          ({ build }) => build.id === filter.buildId
        );
        if (!input) return [filter.id, 0] as const;
        const count = account.relics.filter((relic) => {
          if (relic.slot !== filter.slot) return false;
          const score = scoreRelic(
            relic,
            input.profile,
            scoringContext,
            input.build
          );
          return evaluateBuildFilter(relic, filter, score.total).matches;
        }).length;
        return [filter.id, count] as const;
      })
    );
  }, [account, selectedBuilds, filters, scoringContext]);
  const recommendation = useMemo<LoadoutRecommendation | null>(() => {
    if (!account || selectedBuilds.length === 0 || !scoringContext) return null;
    const parts = selectedBuilds.map(({ build, profile }) =>
      recommendBuildLoadout(account, build, profile, scoringContext)
    );
    const selected = Object.assign(
      {},
      ...parts.map((part) => part.selected)
    ) as LoadoutRecommendation["selected"];
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

  const header = <PageHeader titleKey="route.filters.title" visuallyHidden />;
  if (loading || error || !data || !scoringContext) {
    return (
      <PageLayout>
        {header}
        <ScrollLayout>
          {loading ? <CatalogLoading /> : <CatalogLoadError error={error} />}
        </ScrollLayout>
      </PageLayout>
    );
  }
  if (builds.length === 0 || !characterId) {
    return (
      <PageLayout>
        {header}
        <ScrollLayout>
          <WorkspaceStartState
            messageKey="filters.needsBuild"
            icon={Filter}
            requires="builds"
          />
        </ScrollLayout>
      </PageLayout>
    );
  }

  const character = data.characters.byId.get(characterId);
  const characterName = character
    ? characterCatalogPresentation(
        character,
        data.properties,
        locale,
        t("terms.trailblazer")
      ).name
    : characterId;
  const buildOptions = (
    entries: typeof cavernBuilds,
    selected: (typeof cavernBuilds)[number] | undefined
  ) => ({
    value: selected?.id ?? "none",
    options: entries.length
      ? entries.map((entry) => ({
          value: entry.id,
          label: buildDisplayName(entry, data, locale),
        }))
      : [{ value: "none", label: t("filters.noCategoryBuild") }],
  });
  const cavernSelect = buildOptions(cavernBuilds, cavern);
  const planarSelect = buildOptions(planarBuilds, planar);
  const selectedSlotName = selectedFilter
    ? localizedName(
        data.properties.relicSlotById.get(
          CATALOG_RELIC_SLOT[selectedFilter.slot]
        )?.name,
        locale,
        selectedFilter.slot
      )
    : null;

  return (
    <PageLayout>
      {header}
      <SidebarLayout
        sidebar={
          <RelicFilterSidebar
            characters={characterOptions}
            selectedCharacterId={characterId}
            onSelectCharacter={(id) => {
              setSelectedCharacterId(id);
              setSelectedCavernId("");
              setSelectedPlanarId("");
              setSelectedFilterId("");
            }}
            cavernOptions={cavernSelect.options}
            cavernValue={cavernSelect.value}
            onCavernChange={(id) => {
              setSelectedCavernId(id);
              setSelectedFilterId("");
            }}
            hasCavern={cavernBuilds.length > 0}
            planarOptions={planarSelect.options}
            planarValue={planarSelect.value}
            onPlanarChange={(id) => {
              setSelectedPlanarId(id);
              setSelectedFilterId("");
            }}
            hasPlanar={planarBuilds.length > 0}
            matchesOnly={matchesOnly}
            onMatchesOnlyChange={setMatchesOnly}
            matchesOnlyDisabled={!account}
          />
        }
      >
        <div className="min-w-0 space-y-2 lg:space-y-3">
          <SourceCoverageNotice account={account} />
          {!build || !profile || !character ? (
            <EmptyState messageKey="filters.missingProfile" icon={Filter} />
          ) : (
            <>
              {selectedBuilds.map(({ build: entry }) => (
                <FilterSetCard
                  key={entry.id}
                  kind={entry.category}
                  build={entry}
                  filters={filters.filter(
                    (filter) => filter.buildId === entry.id
                  )}
                  character={character}
                  characterName={characterName}
                  references={data}
                  setsById={setsById}
                  matchCounts={matchCounts}
                  selectedFilterId={selectedFilter?.id ?? null}
                  onSelectFilter={setSelectedFilterId}
                  compact={compact}
                />
              ))}

              {recommendation && (
                <RecommendedLoadoutCard
                  recommendation={recommendation}
                  references={data}
                />
              )}

              <Card className="bg-gradient-card" data-filter-candidates>
                <CardHeader className="p-3 md:px-6 md:pb-3 md:pt-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base leading-tight md:text-xl">
                      {t("filters.inventoryTitle")}
                    </CardTitle>
                    {selectedSlotName && account && (
                      <Badge variant="outline">{selectedSlotName}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:px-6 md:pb-4">
                  {!account ? (
                    <EmptyState
                      variant="inline"
                      messageKey="filters.needsAccount"
                      icon={Sparkles}
                    >
                      <AccountImportAction size="sm" className="mt-1" />
                    </EmptyState>
                  ) : evaluatedRelics.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {t("filters.noMatches")}
                    </p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {evaluatedRelics
                        .slice(0, CANDIDATE_LIMIT)
                        .map(({ relic, score, match }) => (
                          <RelicScoreCard
                            key={relic.key}
                            variant="nested"
                            relic={relic}
                            score={score}
                            references={data}
                            locale={locale}
                            selected={match.matches}
                          >
                            <MatchSummary match={match} />
                          </RelicScoreCard>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SidebarLayout>
    </PageLayout>
  );
}
