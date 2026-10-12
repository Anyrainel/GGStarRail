import {
  ArrowDown,
  ArrowUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Filter,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
import { WorkspaceStartState } from "@/components/game-account/imports/WorkspaceStartState";
import { AccountSourceBadge } from "@/components/game-account/planning/AccountSourceBadge";
import {
  RelicSetFilterGroup,
  type RelicSetFilterRow,
} from "@/components/game-account/planning/RelicSetFilterGroup";
import { TriageManagerDialog } from "@/components/game-account/planning/TriageManagerDialog";
import { TriageRelicCard } from "@/components/game-account/planning/TriageRelicCard";
import { TriageRulesPopover } from "@/components/game-account/planning/TriageRulesPopover";
import {
  TRIAGE_DECISION,
  TRIAGE_DECISIONS,
  TRIAGE_GRADES,
  TRIAGE_SORTS,
  type TriageGradeKey,
  type TriageSortDirection,
  type TriageSortKey,
  triageGradeKey,
} from "@/components/game-account/planning/triagePresentation";
import { useGridColumns } from "@/components/game-account/planning/useGridColumns";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterChip } from "@/components/shared/FilterChip";
import { HelpButton } from "@/components/shared/HelpButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { RelicSlotChips } from "@/components/shared/relic/RelicSlotChips";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import {
  BUILD_SLOT_ORDER,
  evaluateAccountTriage,
  type RelicTriageEvaluation,
  summarizeAccountTriage,
} from "@/domain/build/evaluation";
import type { TriageDecision } from "@/domain/build/triage";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { HSR_REFERENCE_REVISION } from "@/providers/reference/catalog";
import { createManagerInstructionPreview } from "@/providers/scanner/companion/instructions";
import { createRelicScoringContext } from "@/services/catalog/buildReferences";
import { localizedName } from "@/services/catalog/presentation";
import type {
  RelicKind,
  RelicSlotId,
} from "@/services/catalog/relicPresentation";
import { reconcileManagerResult } from "@/services/scanner/reconcile";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const RELIC_KINDS: readonly RelicKind[] = ["cavern", "planar"];

interface TriageSort {
  key: TriageSortKey;
  direction: TriageSortDirection;
}

export function TriageView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const rules = useWorkspaceStore((state) => state.triageRules);
  const setRules = useWorkspaceStore((state) => state.setTriageRules);
  const { data, error, loading } = useBuildReferences();
  // Below md the toolbar would take too much of the viewport, so it scrolls
  // with the results and only the decision tabs stay pinned.
  const narrow = useMediaQuery("(max-width: 767px)");
  // Phones drop the tab icons and shrink the labels so all three fit.
  const compactTabs = useMediaQuery("(max-width: 639px)");
  const tabsId = useId();
  const [decision, setDecision] = useState<TriageDecision | null>(null);
  const [grades, setGrades] = useState<ReadonlySet<TriageGradeKey>>(
    () => new Set(TRIAGE_GRADES)
  );
  const [slots, setSlots] = useState<ReadonlySet<RelicSlotId>>(() => new Set());
  const [sets, setSets] = useState<ReadonlySet<string>>(() => new Set());
  const [sort, setSort] = useState<TriageSort>({
    key: "score",
    direction: "desc",
  });
  // Expansion is keyed by visual row per decision tab, so a row always opens
  // and closes as a whole, even after sorting, filtering, or a resize.
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [managerOpen, setManagerOpen] = useState(false);
  const { ref: gridRef, columns } = useGridColumns<HTMLDivElement>();

  const scoringContext = useMemo(
    () => (data ? createRelicScoringContext(data) : null),
    [data]
  );
  const evaluations = useMemo(
    () =>
      account && scoringContext
        ? evaluateAccountTriage(
            account,
            builds,
            profiles,
            rules,
            scoringContext
          )
        : [],
    [account, builds, profiles, rules, scoringContext]
  );
  const summary = useMemo(
    () => summarizeAccountTriage(evaluations),
    [evaluations]
  );
  const buildsById = useMemo(
    () => new Map(builds.map((build) => [build.id, build])),
    [builds]
  );
  const counts = useMemo(() => {
    const grade = new Map<TriageGradeKey, number>();
    const slot: Partial<Record<RelicSlotId, number>> = {};
    const set = new Map<string, number>();
    for (const evaluation of evaluations) {
      const key = triageGradeKey(evaluation);
      grade.set(key, (grade.get(key) ?? 0) + 1);
      slot[evaluation.relic.slot] = (slot[evaluation.relic.slot] ?? 0) + 1;
      set.set(
        evaluation.relic.setId,
        (set.get(evaluation.relic.setId) ?? 0) + 1
      );
    }
    return { grade, slot, set };
  }, [evaluations]);
  const setRows = useMemo<RelicSetFilterRow[]>(
    () =>
      RELIC_KINDS.map((kind) => ({
        kind,
        sets: [...counts.set]
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
      })),
    [counts.set, data, locale]
  );
  const setNameById = useMemo(
    () =>
      new Map(
        setRows.flatMap((row) => row.sets.map((set) => [set.setId, set.name]))
      ),
    [setRows]
  );
  const filtered = useMemo(
    () =>
      evaluations.filter(
        (evaluation) =>
          grades.has(triageGradeKey(evaluation)) &&
          (slots.size === 0 || slots.has(evaluation.relic.slot)) &&
          (sets.size === 0 || sets.has(evaluation.relic.setId))
      ),
    [evaluations, grades, sets, slots]
  );
  const decisionCounts = useMemo(() => {
    const result: Record<TriageDecision, number> = {
      keep: 0,
      review: 0,
      "salvage-review": 0,
    };
    for (const evaluation of filtered) result[evaluation.result.decision] += 1;
    return result;
  }, [filtered]);
  const activeDecision: TriageDecision =
    decision ??
    TRIAGE_DECISIONS.find((value) => summary.decisions[value] > 0) ??
    "keep";
  const items = useMemo(() => {
    const slotIndex = (evaluation: RelicTriageEvaluation) =>
      BUILD_SLOT_ORDER.indexOf(evaluation.relic.slot);
    const bySet = (left: RelicTriageEvaluation, right: RelicTriageEvaluation) =>
      (setNameById.get(left.relic.setId) ?? left.relic.setId).localeCompare(
        setNameById.get(right.relic.setId) ?? right.relic.setId,
        locale
      ) || slotIndex(left) - slotIndex(right);
    const primary: Record<
      TriageSortKey,
      (left: RelicTriageEvaluation, right: RelicTriageEvaluation) => number
    > = {
      score: (left, right) => left.score - right.score,
      set: bySet,
      level: (left, right) => left.relic.level - right.relic.level,
    };
    const sign = sort.direction === "asc" ? 1 : -1;
    return filtered
      .filter((evaluation) => evaluation.result.decision === activeDecision)
      .sort(
        (left, right) =>
          sign * primary[sort.key](left, right) ||
          right.score - left.score ||
          bySet(left, right) ||
          left.relic.key.localeCompare(right.relic.key)
      );
  }, [activeDecision, filtered, locale, setNameById, sort]);
  const rowCount = Math.ceil(items.length / columns);
  const rowKey = (row: number) => `${activeDecision}:${row}`;
  const isRowExpanded = (index: number) =>
    expandedRows.has(rowKey(Math.floor(index / columns)));
  const hasExpanded = Array.from({ length: rowCount }, (_, row) =>
    rowKey(row)
  ).some((key) => expandedRows.has(key));

  const createPreview = useCallback(() => {
    if (!account) return Promise.reject(new Error("No account"));
    return createManagerInstructionPreview(
      account,
      evaluations,
      HSR_REFERENCE_REVISION
    );
  }, [account, evaluations]);

  const startState = !account
    ? builds.length === 0
      ? ({ messageKey: "triage.needsBoth", requires: "both" } as const)
      : ({ messageKey: "triage.needsAccount", requires: "account" } as const)
    : builds.length === 0
      ? ({ messageKey: "triage.needsBuild", requires: "builds" } as const)
      : null;

  if (!account || startState || loading || error || !data || !scoringContext) {
    return (
      <PageLayout>
        <PageHeader titleKey="route.triage.title" visuallyHidden />
        <ScrollLayout bodyClassName="space-y-4">
          {startState ? (
            <WorkspaceStartState
              messageKey={startState.messageKey}
              requires={startState.requires}
              icon={ShieldCheck}
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

  function toggleRow(index: number) {
    const key = rowKey(Math.floor(index / columns));
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    const prefix = `${activeDecision}:`;
    setExpandedRows((current) => {
      const next = new Set(
        [...current].filter((key) => !key.startsWith(prefix))
      );
      if (!hasExpanded) {
        for (let row = 0; row < rowCount; row += 1) next.add(rowKey(row));
      }
      return next;
    });
  }

  function toggleSort(key: TriageSortKey) {
    setSort((current) =>
      current.key === key
        ? {
            key,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : {
            key,
            direction:
              TRIAGE_SORTS.find((option) => option.key === key)?.initial ??
              "desc",
          }
    );
  }

  const slotLabel = (slot: RelicSlotId) =>
    localizedName(
      data.properties.relicSlotById.get(CATALOG_RELIC_SLOT[slot])?.name,
      locale,
      slot
    );
  const ExpandIcon = hasExpanded ? ChevronsDownUp : ChevronsUpDown;

  const toolbar = (
    <div className="space-y-3" data-triage-toolbar>
      <PageHeader titleKey="route.triage.title">
        <HelpButton title={t("route.triage.title")}>
          <dl className="space-y-2">
            {TRIAGE_DECISIONS.map((value) => {
              const presentation = TRIAGE_DECISION[value];
              const Icon = presentation.icon;
              return (
                <div key={value}>
                  <dt className="flex items-center gap-1.5 font-semibold">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t(presentation.labelKey)}
                  </dt>
                  <dd className="text-muted-foreground">
                    {t(presentation.helpKey)}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-muted-foreground">{t("triage.help.order")}</p>
        </HelpButton>
        <AccountSourceBadge account={account} />
        <TriageRulesPopover
          rules={rules}
          defaults={DEFAULT_WORKSPACE.triageRules}
          onChange={setRules}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => setManagerOpen(true)}
        >
          <Monitor className="h-4 w-4" aria-hidden="true" />
          {t("manager.apply")}
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm">
          {t("triage.analyzed", { count: summary.total })}
        </p>
        <fieldset
          aria-label={t("triage.gradeFilter")}
          className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0 md:ml-2"
        >
          {TRIAGE_GRADES.map((grade) => (
            <FilterChip
              key={grade}
              active={grades.has(grade)}
              onClick={() =>
                setGrades((current) => {
                  const next = new Set(current);
                  if (next.has(grade)) next.delete(grade);
                  else next.add(grade);
                  return next;
                })
              }
              count={counts.grade.get(grade) ?? 0}
              className="text-sm"
            >
              <span
                className={cn(
                  "font-semibold",
                  grade === "S" && "text-[hsl(var(--quality-gold))]"
                )}
              >
                {grade === "none" ? t("triage.ungraded") : grade}
              </span>
            </FilterChip>
          ))}
        </fieldset>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <span className="text-sm font-medium">{t("triage.sort.label")}</span>
          {TRIAGE_SORTS.map((option) => {
            const active = sort.key === option.key;
            const Arrow =
              active && sort.direction === "asc" ? ArrowUp : ArrowDown;
            return (
              <Button
                key={option.key}
                type="button"
                variant="outline"
                aria-pressed={active}
                onClick={() => toggleSort(option.key)}
                className={cn(
                  "h-7 gap-1 px-2 text-sm",
                  active && "border-primary/40 bg-primary/15 text-foreground"
                )}
              >
                {t(option.labelKey)}
                <Arrow
                  className={cn("h-3.5 w-3.5", !active && "opacity-30")}
                  aria-hidden="true"
                />
              </Button>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="h-7 gap-1 px-2 text-sm"
            disabled={items.length === 0}
            onClick={toggleAll}
          >
            {hasExpanded ? t("triage.collapseAll") : t("triage.expandAll")}
            <ExpandIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <RelicSlotChips
        value={slots}
        onChange={setSlots}
        slotLabel={slotLabel}
        counts={counts.slot}
      />
      <RelicSetFilterGroup
        label={t("triage.setFilter")}
        rows={setRows}
        value={sets}
        onChange={setSets}
      />
    </div>
  );

  const panelId = `${tabsId}-panel`;
  const tabId = (value: TriageDecision) => `${tabsId}-${value}`;

  return (
    <PageLayout>
      <ScrollLayout
        header={narrow ? undefined : toolbar}
        bodyClassName="space-y-3"
      >
        {narrow && toolbar}
        <SourceCoverageNotice account={account} />
        <div className="sticky top-0 z-20 bg-background pb-1 pt-px">
          <SegmentedTabs
            fullWidth
            className="max-sm:[&_[role=tab]]:px-1.5 max-sm:[&_[role=tab]]:text-xs"
            label={t("triage.filterLabel")}
            value={activeDecision}
            onValueChange={setDecision}
            tabId={tabId}
            panelId={() => panelId}
            items={TRIAGE_DECISIONS.map((value) => ({
              value,
              label: t(TRIAGE_DECISION[value].labelKey),
              icon: compactTabs ? undefined : TRIAGE_DECISION[value].icon,
              count: decisionCounts[value],
            }))}
          />
        </div>
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(activeDecision)}
        >
          {items.length === 0 ? (
            <EmptyState
              variant="inline"
              messageKey="triage.noResults"
              icon={Filter}
            />
          ) : (
            <div
              ref={gridRef}
              className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            >
              {items.map((evaluation, index) => (
                <TriageRelicCard
                  key={evaluation.relic.key}
                  evaluation={evaluation}
                  references={data}
                  buildsById={buildsById}
                  expanded={isRowExpanded(index)}
                  onToggle={() => toggleRow(index)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollLayout>
      <TriageManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        createPreview={createPreview}
        onResult={(result, submitted) => {
          const workspace = useWorkspaceStore.getState();
          if (workspace.account !== account) return false;
          workspace.replaceAccount(
            reconcileManagerResult(account, submitted, result)
          );
          return true;
        }}
      />
    </PageLayout>
  );
}
