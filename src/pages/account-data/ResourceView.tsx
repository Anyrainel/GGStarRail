import { PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { AccountSourceBadge } from "@/components/account-data/planning/AccountSourceBadge";
import { ResourceActionToggle } from "@/components/account-data/planning/ResourceActionToggle";
import { ResourcePriorityGroup } from "@/components/account-data/planning/ResourcePriorityGroup";
import {
  type ResourceSetGroup,
  ResourceSetStrip,
} from "@/components/account-data/planning/ResourceSetStrip";
import { ResourceSuggestionCard } from "@/components/account-data/planning/ResourceSuggestionCard";
import {
  RESOURCE_ACTION,
  RESOURCE_ACTIONS,
  RESOURCE_PRIORITIES,
  RESOURCE_PRIORITY_LABEL,
} from "@/components/account-data/planning/resourcePresentation";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import { CategoryChip } from "@/components/shared/CategoryChip";
import { HelpButton } from "@/components/shared/HelpButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { generateResourceSuggestions } from "@/domain/resources/recommendations";
import type {
  ResourceActionKind,
  ResourceSettings,
  ResourceSuggestionPriority,
} from "@/domain/resources/schemas";
import type { ResourceRelicDefinition } from "@/domain/resources/types";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { accountRelicSlot } from "@/providers/accountNormalization";
import { createRelicScoringContext } from "@/services/catalog/buildReferences";
import { localizedName } from "@/services/catalog/presentation";
import type { RelicKind } from "@/services/catalog/relicPresentation";
import { useResourceSettingsStore } from "@/stores/useResourceSettingsStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const RELIC_KINDS: readonly RelicKind[] = ["cavern", "planar"];

const ALL_ACTIONS: ResourceSettings["enabledActions"] = {
  "level-up": true,
  synthesize: true,
  reroll: true,
};

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
  const [kinds, setKinds] = useState<Record<RelicKind, boolean>>({
    cavern: true,
    planar: true,
  });
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<
    ReadonlySet<ResourceSuggestionPriority>
  >(() => new Set());

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
  // Every action is generated so a hidden action keeps its count; the saved
  // action toggles only decide which rows are shown.
  const minimumScoreGap = settings.minimumScoreGap;
  const suggestions = useMemo(
    () =>
      account && scoringContext
        ? generateResourceSuggestions({
            account,
            builds,
            scoreProfiles,
            scoringContext,
            relicDefinitions,
            settings: { enabledActions: ALL_ACTIONS, minimumScoreGap },
          })
        : [],
    [
      account,
      builds,
      minimumScoreGap,
      relicDefinitions,
      scoreProfiles,
      scoringContext,
    ]
  );
  const actionCounts = useMemo(() => {
    const counts: Record<ResourceActionKind, number> = {
      "level-up": 0,
      synthesize: 0,
      reroll: 0,
    };
    for (const suggestion of suggestions) counts[suggestion.kind] += 1;
    return counts;
  }, [suggestions]);
  const enabledActions = settings.enabledActions;
  const kindFiltered = useMemo(
    () =>
      suggestions.filter(
        (suggestion) =>
          enabledActions[suggestion.kind] && kinds[suggestion.category]
      ),
    [enabledActions, kinds, suggestions]
  );
  const setGroups = useMemo<ResourceSetGroup[]>(() => {
    const counts = new Map<string, number>();
    for (const suggestion of kindFiltered)
      counts.set(suggestion.setId, (counts.get(suggestion.setId) ?? 0) + 1);
    return RELIC_KINDS.map((kind) => ({
      kind,
      sets: [...counts]
        .flatMap(([setId, count]) => {
          const set = data?.relicSets.byId.get(setId);
          const setKind: RelicKind =
            set?.kind === "planar_ornament" ? "planar" : "cavern";
          if (setKind !== kind) return [];
          return [
            {
              setId,
              count,
              name: localizedName(set?.name, locale, setId),
              iconPath: set?.icon_path ?? "",
            },
          ];
        })
        .sort((left, right) => left.name.localeCompare(right.name, locale)),
    }));
  }, [data, kindFiltered, locale]);
  const setCount = setGroups.reduce(
    (total, group) => total + group.sets.length,
    0
  );
  const activeSetId = setGroups.some((group) =>
    group.sets.some((set) => set.setId === selectedSetId)
  )
    ? selectedSetId
    : null;
  const visible = activeSetId
    ? kindFiltered.filter((suggestion) => suggestion.setId === activeSetId)
    : kindFiltered;
  const relicByKey = useMemo(
    () => new Map((account?.relics ?? []).map((relic) => [relic.key, relic])),
    [account?.relics]
  );

  const startState = !account
    ? builds.length === 0
      ? ({ messageKey: "resource.needsBoth", requires: "both" } as const)
      : ({ messageKey: "resource.needsAccount", requires: "account" } as const)
    : builds.length === 0
      ? ({ messageKey: "resource.needsBuild", requires: "builds" } as const)
      : null;

  if (!account || startState || loading || error || !data || !scoringContext) {
    return (
      <PageLayout>
        <PageHeader titleKey="route.resources.title" visuallyHidden />
        <ScrollLayout bodyClassName="space-y-4">
          {startState ? (
            <WorkspaceStartState
              messageKey={startState.messageKey}
              requires={startState.requires}
              icon={PackageSearch}
            />
          ) : loading ? (
            <CatalogLoading />
          ) : (
            <CatalogLoadError error={error} />
          )}
        </ScrollLayout>
      </PageLayout>
    );
  }

  const toggleGroup = (priority: ResourceSuggestionPriority) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });

  const toolbar = (
    <div className="space-y-3">
      <PageHeader titleKey="route.resources.title">
        <HelpButton title={t("route.resources.title")}>
          <p>{t("resource.advisoryBoundary")}</p>
          <dl className="space-y-2">
            {RESOURCE_ACTIONS.map((kind) => {
              const action = RESOURCE_ACTION[kind];
              const Icon = action.icon;
              return (
                <div key={kind}>
                  <dt className="flex items-center gap-1.5 font-semibold">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t(action.labelKey)}
                  </dt>
                  <dd className="text-muted-foreground">{t(action.helpKey)}</dd>
                </div>
              );
            })}
            <div>
              <dt className="font-semibold">{t("resource.minimumGap")}</dt>
              <dd className="text-muted-foreground">
                {t("resource.minimumGapHelp")}
              </dd>
            </div>
          </dl>
        </HelpButton>
        <AccountSourceBadge account={account} />
        <span className="text-sm tabular-nums text-muted-foreground">
          ({visible.length})
        </span>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-1.5 md:gap-3">
        {RESOURCE_ACTIONS.map((kind) => (
          <ResourceActionToggle
            key={kind}
            kind={kind}
            enabled={settings.enabledActions[kind]}
            count={actionCounts[kind]}
            threshold={settings.minimumScoreGap[kind]}
            onEnabledChange={(enabled) => setActionEnabled(kind, enabled)}
            onThresholdChange={(value) => setMinimumScoreGap(kind, value)}
          />
        ))}
        <fieldset
          aria-label={t("resource.filterCategory")}
          className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0 lg:ml-2"
        >
          {RELIC_KINDS.map((kind) => (
            <CategoryChip
              key={kind}
              active={kinds[kind]}
              onClick={() =>
                setKinds((current) => ({ ...current, [kind]: !current[kind] }))
              }
              label={t(
                kind === "cavern"
                  ? "resource.category.cavern"
                  : "resource.category.planar"
              )}
              icon={
                <RelicKindIcon kind={kind} className="h-3.5 w-3.5" decorative />
              }
            />
          ))}
        </fieldset>
      </div>
      {setCount > 1 && (
        <ResourceSetStrip
          label={t("resource.filterSet")}
          groups={setGroups}
          value={activeSetId}
          onChange={setSelectedSetId}
        />
      )}
    </div>
  );

  return (
    <PageLayout>
      <ScrollLayout header={toolbar} bodyClassName="space-y-4">
        <SourceCoverageNotice account={account} />
        {visible.length === 0 ? (
          <p className="pt-4 text-sm text-muted-foreground">
            {t("resource.noSuggestions")}
          </p>
        ) : (
          RESOURCE_PRIORITIES.map((priority) => {
            const group = visible.filter(
              (suggestion) => suggestion.priority === priority
            );
            if (group.length === 0) return null;
            return (
              <ResourcePriorityGroup
                key={priority}
                label={t(RESOURCE_PRIORITY_LABEL[priority])}
                count={group.length}
                collapsed={collapsed.has(priority)}
                onToggle={() => toggleGroup(priority)}
              >
                {group.map((suggestion) => (
                  <ResourceSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    references={data}
                    sourceRelic={
                      suggestion.kind === "synthesize"
                        ? undefined
                        : relicByKey.get(suggestion.relicKey)
                    }
                  />
                ))}
              </ResourcePriorityGroup>
            );
          })
        )}
      </ScrollLayout>
    </PageLayout>
  );
}
