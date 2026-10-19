import { ArrowUpRight, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AccountCoverageNotice } from "@/components/game-account/imports/AccountCoverageNotice";
import { WorkspaceStartState } from "@/components/game-account/imports/WorkspaceStartState";
import { RecommendationLoadout } from "@/components/game-account/RecommendationLoadout";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import { EmptyState } from "@/components/shared/EmptyState";
import { HelpButton } from "@/components/shared/HelpButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { APP_PATHS } from "@/config/navigation";
import { estimateRelicPotential } from "@/domain/build/completion";
import { BUILD_SLOT_ORDER } from "@/domain/build/evaluation";
import {
  availableRecommendationBuilds,
  recommendCharacterEquipment,
} from "@/domain/build/recommendations";
import { relicCategory } from "@/domain/game-account/schemas";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { buildDisplayName } from "@/services/builds/presentation";
import { createRelicScoringContext } from "@/services/catalog/buildReferences";
import { characterCatalogName } from "@/services/catalog/presentation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function ScoreUpView() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useSearchParams();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const apply = useWorkspaceStore((state) => state.applyRecommendedLoadout);
  const { data, loading, error } = useBuildReferences();
  const [chosen, setChosen] = useState<
    Partial<Record<"cavern" | "planar", string>>
  >({});
  const characters = useMemo(
    () =>
      account?.characters.filter((character) =>
        availableRecommendationBuilds(
          account,
          character.definitionId,
          builds
        ).some((build) =>
          profiles.some((profile) => profile.id === build.scoreProfileId)
        )
      ) ?? [],
    [account, builds, profiles]
  );
  const character =
    characters.find(
      (entry) => entry.definitionId === search.get("character")
    ) ?? characters[0];
  const available =
    account && character
      ? availableRecommendationBuilds(
          account,
          character.definitionId,
          builds
        ).filter((build) =>
          profiles.some((profile) => profile.id === build.scoreProfileId)
        )
      : [];
  const selectedBuilds = (["cavern", "planar"] as const).flatMap((category) => {
    const entries = available.filter((build) => build.category === category);
    const selected =
      entries.find((entry) => entry.id === chosen[category]) ??
      entries.find((entry) => entry.id === search.get("build")) ??
      entries[0];
    return selected ? [selected] : [];
  });
  const context = useMemo(
    () => (data ? createRelicScoringContext(data) : null),
    [data]
  );
  const recommendation =
    account && character && context
      ? recommendCharacterEquipment(
          account,
          character.key,
          selectedBuilds,
          profiles,
          context
        )
      : null;
  const start = !account
    ? builds.length
      ? ({ key: "scoreUp.needsAccount", requires: "account" } as const)
      : ({ key: "scoreUp.needsBoth", requires: "both" } as const)
    : !builds.length
      ? ({ key: "scoreUp.needsBuild", requires: "builds" } as const)
      : null;
  const potentialByKey = new Map<string, number>();
  if (recommendation && context) {
    for (const entry of Object.values(recommendation.selected)) {
      const build = selectedBuilds.find(
        (candidate) => candidate.category === relicCategory(entry.relic.slot)
      );
      const profile = profiles.find(
        (candidate) => candidate.id === build?.scoreProfileId
      );
      const piece = context.relicPieces.get(entry.relic.definitionId);
      if (build && profile && piece && entry.relic.level < piece.max_level) {
        potentialByKey.set(
          entry.relic.key,
          estimateRelicPotential(entry.relic, profile, context, build)
        );
      }
    }
  }
  return (
    <PageLayout>
      <PageHeader titleKey="route.recommendations.title" visuallyHidden />
      <ScrollLayout bodyClassName="space-y-5">
        {start ? (
          <WorkspaceStartState
            messageKey={start.key}
            requires={start.requires}
            icon={TrendingUp}
          />
        ) : loading ? (
          <CatalogLoading />
        ) : error || !data ? (
          <CatalogLoadError error={error} />
        ) : !character || !recommendation ? (
          <EmptyState messageKey="scoreUp.noCharacter" icon={TrendingUp}>
            <Button asChild>
              <Link to={APP_PATHS.builds}>{t("empty.openBuilds")}</Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            <AccountCoverageNotice account={account} />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="min-w-0 space-y-1.5 text-sm font-medium">
                <p>{t("scoreUp.character")}</p>
                <LightweightSelect
                  value={character.definitionId}
                  onValueChange={(value) => {
                    setChosen({});
                    setSearch({ character: value });
                  }}
                >
                  <LightweightSelectTrigger aria-label={t("scoreUp.character")}>
                    <LightweightSelectValue />
                  </LightweightSelectTrigger>
                  <LightweightSelectContent>
                    {characters.map((entry) => (
                      <LightweightSelectItem
                        key={entry.key}
                        value={entry.definitionId}
                      >
                        {data.characters.byId.has(entry.definitionId)
                          ? characterCatalogName(
                              data.characters.byId.get(entry.definitionId)!,
                              locale,
                              t("terms.trailblazer")
                            )
                          : entry.definitionId}
                      </LightweightSelectItem>
                    ))}
                  </LightweightSelectContent>
                </LightweightSelect>
              </div>
              {(["cavern", "planar"] as const).map((category) => (
                <div
                  key={category}
                  className="min-w-0 space-y-1.5 text-sm font-medium"
                >
                  <p>
                    {t(
                      category === "cavern"
                        ? "scoreUp.cavern"
                        : "scoreUp.planar"
                    )}
                  </p>
                  <LightweightSelect
                    disabled={
                      !available.some((build) => build.category === category)
                    }
                    value={
                      selectedBuilds.find(
                        (build) => build.category === category
                      )?.id ?? ""
                    }
                    onValueChange={(value) =>
                      setChosen((current) => ({
                        ...current,
                        [category]: value,
                      }))
                    }
                  >
                    <LightweightSelectTrigger
                      aria-label={t(
                        category === "cavern"
                          ? "scoreUp.cavern"
                          : "scoreUp.planar"
                      )}
                    >
                      <LightweightSelectValue
                        placeholder={t("scoreUp.noBuild")}
                      />
                    </LightweightSelectTrigger>
                    <LightweightSelectContent>
                      {available
                        .filter((build) => build.category === category)
                        .map((build) => (
                          <LightweightSelectItem
                            key={build.id}
                            value={build.id}
                          >
                            {buildDisplayName(build, data, locale)}
                          </LightweightSelectItem>
                        ))}
                    </LightweightSelectContent>
                  </LightweightSelect>
                </div>
              ))}
            </div>
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-gradient-card p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium">{t("scoreUp.average")}</p>
                  <HelpButton title={t("route.recommendations.title")}>
                    <p>{t("scoreUp.rules")}</p>
                    <p>{t("scoreUp.scoreRule")}</p>
                    <p>{t("scoreUp.potentialRule")}</p>
                  </HelpButton>
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {recommendation.complete
                    ? t("scoreUp.gain", {
                        current: recommendation.currentScore.toFixed(1),
                        next: recommendation.recommendedScore.toFixed(1),
                        gain: `${recommendation.scoreGain >= 0 ? "+" : ""}${recommendation.scoreGain.toFixed(1)}`,
                      })
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(
                    !recommendation.complete
                      ? "scoreUp.missing"
                      : !recommendation.changedSlots.length
                        ? "scoreUp.unchanged"
                        : recommendation.currentSetComplete
                          ? "scoreUp.completeSets"
                          : "scoreUp.repairSets"
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link
                    to={`${APP_PATHS.resources}?character=${character.definitionId}`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    {t("scoreUp.openResources")}
                  </Link>
                </Button>
                <Button
                  disabled={
                    !recommendation.complete ||
                    !recommendation.changedSlots.length
                  }
                  onClick={() => {
                    if (!account) return;
                    const keys = BUILD_SLOT_ORDER.flatMap(
                      (slot) => recommendation.selected[slot]?.relic.key ?? []
                    );
                    if (apply(account, character.key, keys))
                      toast.success(t("scoreUp.applied"));
                    else toast.error(t("scoreUp.stale"));
                  }}
                >
                  {t("scoreUp.equip")}
                </Button>
              </div>
            </section>
            {!recommendation.complete && selectedBuilds.length < 2 && (
              <Button asChild variant="outline">
                <Link to={APP_PATHS.builds}>{t("empty.openBuilds")}</Link>
              </Button>
            )}
            <section className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
              <h2 className="font-semibold">{t("scoreUp.recommended")}</h2>
              <RecommendationLoadout
                selected={recommendation.selected}
                current={recommendation.current}
                references={data}
                potentialByKey={potentialByKey}
                recommended
              />
            </section>
            <section className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
              <h2 className="font-semibold">{t("scoreUp.current")}</h2>
              <RecommendationLoadout
                selected={recommendation.current}
                current={recommendation.current}
                references={data}
                unscoredRelics={account?.relics.filter(
                  (relic) => relic.equippedCharacterKey === character.key
                )}
              />
            </section>
          </>
        )}
      </ScrollLayout>
    </PageLayout>
  );
}
