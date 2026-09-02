import {
  ChevronDown,
  Dices,
  Hammer,
  type LucideIcon,
  PackageSearch,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import {
  ChoiceChip,
  NumberField,
  ToggleField,
} from "@/components/builds/BuildControls";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
import { AssetImage } from "@/components/shared/AssetImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import type { RelicCategory } from "@/domain/account/schemas";
import { generateResourceSuggestions } from "@/domain/resources/recommendations";
import type {
  ResourceActionKind,
  ResourceSuggestionPriority,
} from "@/domain/resources/schemas";
import type {
  ResourceRelicDefinition,
  ResourceSuggestion,
} from "@/domain/resources/types";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { createRelicScoringContext } from "@/lib/buildReferences";
import {
  formatAccountStatValue,
  localizedName,
} from "@/lib/catalogPresentation";
import { accountRelicSlot } from "@/providers/accountNormalization";
import { useResourceSettingsStore } from "@/stores/useResourceSettingsStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

type ActionFilter = "all" | ResourceActionKind;
type CategoryFilter = "all" | RelicCategory;
type PriorityFilter = "all" | ResourceSuggestionPriority;

const ACTIONS: readonly ResourceActionKind[] = [
  "level-up",
  "synthesize",
  "reroll",
];
const PRIORITIES: readonly ResourceSuggestionPriority[] = [
  "high",
  "medium",
  "low",
];

const ACTION_ICON: Record<ResourceActionKind, LucideIcon> = {
  "level-up": TrendingUp,
  synthesize: Hammer,
  reroll: Dices,
};

function actionLabelKey(kind: ResourceActionKind): MessageKey {
  if (kind === "level-up") return "resource.action.levelUp";
  if (kind === "synthesize") return "resource.action.synthesize";
  return "resource.action.reroll";
}

function actionHelpKey(kind: ResourceActionKind): MessageKey {
  if (kind === "level-up") return "resource.actionHelp.levelUp";
  if (kind === "synthesize") return "resource.actionHelp.synthesize";
  return "resource.actionHelp.reroll";
}

function priorityLabelKey(priority: ResourceSuggestionPriority): MessageKey {
  if (priority === "high") return "resource.priority.high";
  if (priority === "medium") return "resource.priority.medium";
  return "resource.priority.low";
}

export function ResourceView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const scoreProfiles = useWorkspaceStore((state) => state.scoreProfiles);
  const settings = useResourceSettingsStore((state) => state.settings);
  const setActionEnabled = useResourceSettingsStore(
    (state) => state.setActionEnabled
  );
  const setMinimumScoreGap = useResourceSettingsStore(
    (state) => state.setMinimumScoreGap
  );
  const { data, error, loading } = useBuildReferences();
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [setFilter, setSetFilter] = useState("all");

  const scoringContext = useMemo(
    () => (data ? createRelicScoringContext(data) : null),
    [data]
  );
  const relicDefinitions = useMemo<ResourceRelicDefinition[]>(
    () =>
      data
        ? data.relicPieces.values.map((definition) => ({
            id: definition.id,
            setId: definition.set_id,
            slot: accountRelicSlot(definition.slot),
            rarity: definition.rarity,
            maxLevel: definition.max_level,
          }))
        : [],
    [data]
  );
  const suggestions = useMemo(
    () =>
      account && scoringContext
        ? generateResourceSuggestions({
            account,
            builds,
            scoreProfiles,
            scoringContext,
            relicDefinitions,
            settings,
          })
        : [],
    [account, builds, relicDefinitions, scoreProfiles, scoringContext, settings]
  );
  const visible = suggestions.filter(
    (suggestion) =>
      (actionFilter === "all" || suggestion.kind === actionFilter) &&
      (categoryFilter === "all" || suggestion.category === categoryFilter) &&
      (priorityFilter === "all" || suggestion.priority === priorityFilter) &&
      (setFilter === "all" || suggestion.setId === setFilter)
  );
  const setOptions = useMemo(
    () =>
      [...new Set(suggestions.map(({ setId }) => setId))]
        .map((setId) => ({
          setId,
          definition: data?.relicSets.byId.get(setId),
        }))
        .sort((left, right) =>
          localizedName(
            left.definition?.name,
            locale,
            left.setId
          ).localeCompare(
            localizedName(right.definition?.name, locale, right.setId),
            locale
          )
        ),
    [data, locale, suggestions]
  );
  const actionCounts = Object.fromEntries(
    ACTIONS.map((kind) => [
      kind,
      suggestions.filter((suggestion) => suggestion.kind === kind).length,
    ])
  ) as Record<ResourceActionKind, number>;

  return (
    <>
      <PageHeader
        titleKey="route.resources.title"
        descriptionKey="route.resources.description"
        visuallyHidden
      />
      <SourceCoverageNotice account={account} />
      {!account ? (
        <WorkspaceStartState
          messageKey="resource.needsAccount"
          icon={PackageSearch}
        />
      ) : loading ? (
        <CatalogLoading />
      ) : error || !data || !scoringContext ? (
        <CatalogLoadError error={error} />
      ) : builds.length === 0 ? (
        <EmptyState messageKey="resource.needsBuild" icon={PackageSearch}>
          <Button asChild size="sm">
            <Link to={APP_PATHS.builds}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {t("resource.openBuilds")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 bg-gradient-select p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {t("resource.settingsTitle")}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t("resource.settingsHelp")}
                  </span>
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <CardContent className="grid gap-3 border-t border-border p-4 lg:grid-cols-3">
                {ACTIONS.map((kind) => (
                  <div key={kind} className="space-y-3">
                    <ToggleField
                      label={t(actionLabelKey(kind))}
                      description={t(actionHelpKey(kind))}
                      checked={settings.enabledActions[kind]}
                      onChange={(enabled) => setActionEnabled(kind, enabled)}
                    />
                    <NumberField
                      label={t("resource.minimumGap")}
                      value={settings.minimumScoreGap[kind]}
                      min={0}
                      max={100}
                      suffix="%"
                      help={t("resource.minimumGapHelp")}
                      onChange={(value) => setMinimumScoreGap(kind, value)}
                    />
                  </div>
                ))}
              </CardContent>
            </details>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            {ACTIONS.map((kind) => {
              const Icon = ACTION_ICON[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={actionFilter === kind}
                  className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    setActionFilter((current) =>
                      current === kind ? "all" : kind
                    )
                  }
                >
                  <Card className="h-full transition-colors hover:border-primary/45">
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="rounded-lg border border-border bg-background/60 p-2 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {t(actionLabelKey(kind))}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t("resource.suggestionCount", {
                            count: actionCounts[kind],
                          })}
                        </span>
                      </span>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          <Card className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <fieldset className="flex flex-wrap items-center gap-2">
                <legend className="mr-2 text-xs font-medium text-muted-foreground">
                  {t("resource.filterAction")}
                </legend>
                <ChoiceChip
                  selected={actionFilter === "all"}
                  onClick={() => setActionFilter("all")}
                >
                  {t("common.all")}
                </ChoiceChip>
                {ACTIONS.map((kind) => (
                  <ChoiceChip
                    key={kind}
                    selected={actionFilter === kind}
                    onClick={() => setActionFilter(kind)}
                  >
                    {t(actionLabelKey(kind))}
                  </ChoiceChip>
                ))}
              </fieldset>
              <fieldset className="min-w-0">
                <legend className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("resource.filterSet")}
                </legend>
                <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <ChoiceChip
                    selected={setFilter === "all"}
                    onClick={() => setSetFilter("all")}
                  >
                    {t("common.all")}
                  </ChoiceChip>
                  {setOptions.map(({ setId, definition }) => (
                    <ChoiceChip
                      key={setId}
                      selected={setFilter === setId}
                      onClick={() => setSetFilter(setId)}
                    >
                      <span className="flex min-w-max items-center gap-1.5">
                        <AssetImage
                          kind="relic-set"
                          id={setId}
                          sourcePath={definition?.icon_path ?? ""}
                          alt=""
                          className="h-5 w-5 rounded object-contain"
                        />
                        {localizedName(definition?.name, locale, setId)}
                      </span>
                    </ChoiceChip>
                  ))}
                </div>
              </fieldset>
              <fieldset className="flex flex-wrap items-center gap-2">
                <legend className="mr-2 text-xs font-medium text-muted-foreground">
                  {t("resource.filterCategory")}
                </legend>
                {(["all", "cavern", "planar"] as const).map((category) => (
                  <ChoiceChip
                    key={category}
                    selected={categoryFilter === category}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category === "all"
                      ? t("common.all")
                      : category === "cavern"
                        ? t("resource.category.cavern")
                        : t("resource.category.planar")}
                  </ChoiceChip>
                ))}
              </fieldset>
              <fieldset className="flex flex-wrap items-center gap-2">
                <legend className="mr-2 text-xs font-medium text-muted-foreground">
                  {t("resource.filterPriority")}
                </legend>
                <ChoiceChip
                  selected={priorityFilter === "all"}
                  onClick={() => setPriorityFilter("all")}
                >
                  {t("common.all")}
                </ChoiceChip>
                {PRIORITIES.map((priority) => (
                  <ChoiceChip
                    key={priority}
                    selected={priorityFilter === priority}
                    onClick={() => setPriorityFilter(priority)}
                  >
                    {t(priorityLabelKey(priority))}
                  </ChoiceChip>
                ))}
              </fieldset>
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4 text-sm">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden
            />
            <p className="leading-6 text-muted-foreground">
              {t("resource.advisoryBoundary")}
            </p>
          </div>

          {visible.length === 0 ? (
            <EmptyState messageKey="resource.noSuggestions" icon={Sparkles} />
          ) : (
            PRIORITIES.map((priority) => {
              const group = visible.filter(
                (suggestion) => suggestion.priority === priority
              );
              if (group.length === 0) return null;
              return (
                <section key={priority} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">
                      {t(priorityLabelKey(priority))}
                    </h2>
                    <Badge variant="outline" className="tabular-nums">
                      {group.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.map((suggestion) => (
                      <ResourceSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        data={data}
                        locale={locale}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

function ResourceSuggestionCard({
  suggestion,
  data,
  locale,
}: {
  suggestion: ResourceSuggestion;
  data: NonNullable<ReturnType<typeof useBuildReferences>["data"]>;
  locale: ReturnType<typeof useI18n>["locale"];
}) {
  const { t } = useI18n();
  const piece = data.relicPieces.byId.get(suggestion.targetDefinitionId);
  const set = data.relicSets.byId.get(suggestion.setId);
  const character = data.characters.byId.get(suggestion.characterDefinitionId);
  const slot = piece
    ? data.properties.relicSlotById.get(piece.slot)
    : undefined;
  const mainStat = data.properties.propertyById.get(suggestion.mainStatId);
  const ActionIcon = ACTION_ICON[suggestion.kind];

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-gradient-card shadow-lg">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <AssetImage
          kind="relic-piece"
          id={piece?.id ?? suggestion.targetDefinitionId}
          sourcePath={piece?.icon_path ?? ""}
          alt={localizedName(
            piece?.name,
            locale,
            suggestion.targetDefinitionId
          )}
          className="h-14 w-14 shrink-0 rounded-lg bg-background/70 object-contain"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold">
              {localizedName(set?.name, locale, suggestion.setId)}
            </h3>
            <Badge className="shrink-0">
              <ActionIcon className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t(actionLabelKey(suggestion.kind))}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("resource.targetFor", {
              character: localizedName(
                character?.name,
                locale,
                suggestion.characterDefinitionId
              ),
            })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {localizedName(slot?.name, locale, suggestion.slot)}
            </Badge>
            <Badge variant="outline">
              {suggestion.category === "cavern"
                ? t("resource.category.cavern")
                : t("resource.category.planar")}
            </Badge>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 text-muted-foreground">
            {localizedName(
              mainStat?.relic_name ?? mainStat?.name,
              locale,
              suggestion.mainStatId
            )}
          </span>
          <span className="font-semibold tabular-nums">
            {t("resource.scoreGap", {
              value: suggestion.opportunityScore.toFixed(1),
            })}
          </span>
        </div>
        {suggestion.kind === "level-up" ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {t("resource.levelDetail", {
              current: suggestion.currentLevel,
              target: suggestion.targetLevel,
              before: suggestion.currentScore?.toFixed(1) ?? "—",
              ceiling: suggestion.optimisticScore.toFixed(1),
            })}
          </p>
        ) : suggestion.kind === "synthesize" ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {suggestion.selfModelingResin === 1
              ? t("resource.synthesizeCustomDetail", {
                  remains: suggestion.relicRemains,
                  resin: suggestion.selfModelingResin,
                })
              : t("resource.synthesizeStandardDetail", {
                  remains: suggestion.relicRemains,
                })}
          </p>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">
            {t("resource.rerollDetail", {
              dice: suggestion.variableDice,
              before: suggestion.currentScore?.toFixed(1) ?? "—",
              ceiling: suggestion.optimisticScore.toFixed(1),
            })}
          </p>
        )}
        {suggestion.currentScore !== null && (
          <p className="text-xs text-muted-foreground">
            {t("resource.currentScore", {
              value: formatAccountStatValue(
                suggestion.currentScore,
                undefined,
                locale
              ),
            })}
          </p>
        )}
      </div>
    </article>
  );
}
