import {
  Download,
  Eye,
  Filter,
  ShieldCheck,
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
  SelectField,
  ToggleField,
} from "@/components/builds/BuildControls";
import { RelicScoreCard } from "@/components/builds/RelicScoreCard";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
import { StatusBanner } from "@/components/builds/StatusBanner";
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
  type RelicCategory,
  type RelicSlot,
  relicCategory,
} from "@/domain/account/schemas";
import {
  BUILD_SLOT_ORDER,
  evaluateAccountTriage,
  type RelicTriageEvaluation,
  summarizeAccountTriage,
} from "@/domain/build/evaluation";
import type { TriageRules } from "@/domain/build/schemas";
import type { TriageDecision, TriageReason } from "@/domain/build/triage";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { createRelicScoringContext } from "@/lib/buildReferences";
import { localizedName } from "@/lib/catalogPresentation";
import {
  createManagerInstructionPreview,
  type ManagerInstructionPreview,
  serializeManagerInstructionEnvelope,
} from "@/lib/managerInstructions";
import { HSR_REFERENCE_MANIFEST } from "@/providers/gilore/catalog";
import type { RelicSlotId } from "@/providers/gilore/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

type DecisionFilter = "all" | TriageDecision;
type CategoryFilter = "all" | RelicCategory;
type SlotFilter = "all" | RelicSlot;

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, RelicSlotId>;

const DECISIONS: readonly TriageDecision[] = [
  "keep",
  "review",
  "salvage-review",
];

export function TriageView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const rules = useWorkspaceStore((state) => state.triageRules);
  const setRules = useWorkspaceStore((state) => state.setTriageRules);
  const { data, error, loading } = useBuildReferences();
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [managerPreview, setManagerPreview] =
    useState<ManagerInstructionPreview | null>(null);
  const [managerBusy, setManagerBusy] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
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
  const visible = evaluations.filter(
    ({ relic, result }) =>
      (decisionFilter === "all" || result.decision === decisionFilter) &&
      (categoryFilter === "all" ||
        relicCategory(relic.slot) === categoryFilter) &&
      (slotFilter === "all" || relic.slot === slotFilter)
  );
  const managerActionability = managerPreview?.actionability ?? null;
  const slotOptions = [
    { value: "all", label: t("triage.allSlots") },
    ...BUILD_SLOT_ORDER.map((slot) => ({
      value: slot,
      label: localizedName(
        data?.properties.relicSlotById.get(DOMAIN_SLOT_TO_CATALOG[slot])?.name,
        locale,
        slot
      ),
    })),
  ];

  function updateRules(next: TriageRules) {
    setRules(next);
    setManagerPreview(null);
  }

  async function createPreview() {
    if (!account) return;
    setManagerBusy(true);
    setManagerError(null);
    try {
      const preview = await createManagerInstructionPreview(
        account,
        evaluations,
        HSR_REFERENCE_MANIFEST.source.revision
      );
      setManagerPreview(preview);
    } catch {
      setManagerError(t("triage.managerError"));
    } finally {
      setManagerBusy(false);
    }
  }

  function downloadPreview() {
    if (!managerPreview) return;
    const json = serializeManagerInstructionEnvelope(managerPreview.envelope);
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ggstarrail-manager-${managerPreview.envelope.requestId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        titleKey="route.triage.title"
        descriptionKey="route.triage.description"
        visuallyHidden
      />
      <SourceCoverageNotice account={account} />
      {!account ? (
        <WorkspaceStartState
          messageKey="triage.needsAccount"
          icon={ShieldCheck}
        />
      ) : loading ? (
        <CatalogLoading />
      ) : error || !data || !scoringContext ? (
        <CatalogLoadError error={error} />
      ) : builds.length === 0 ? (
        <EmptyState messageKey="triage.needsBuild" icon={ShieldCheck}>
          <Button asChild size="sm">
            <Link to={APP_PATHS.builds}>{t("triage.openBuilds")}</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <section
            aria-labelledby="triage-summary-heading"
            className="space-y-3"
          >
            <div>
              <h2 id="triage-summary-heading" className="text-sm font-semibold">
                {t("triage.summaryTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("triage.summaryHelp")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {DECISIONS.map((decision) => (
                <button
                  key={decision}
                  type="button"
                  aria-label={`${t("triage.filterLabel")}: ${decisionLabel(
                    decision,
                    t
                  )}`}
                  aria-pressed={decisionFilter === decision}
                  className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    setDecisionFilter((current) =>
                      current === decision ? "all" : decision
                    )
                  }
                >
                  <Card className="h-full transition-colors hover:border-primary/45">
                    <CardContent className="p-3 sm:p-4">
                      <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">
                        {decisionLabel(decision, t)}
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                        {summary.decisions[decision]}
                      </p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </section>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-select p-4">
              <CardTitle className="text-sm">
                {t("triage.rulesTitle")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("triage.rulesHelp")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              <NumberField
                label={t("triage.keepThreshold")}
                value={rules.keepScoreAtLeast}
                min={rules.reviewScoreAtLeast}
                max={100}
                suffix="%"
                onChange={(keepScoreAtLeast) =>
                  updateRules({ ...rules, keepScoreAtLeast })
                }
              />
              <NumberField
                label={t("triage.reviewThreshold")}
                value={rules.reviewScoreAtLeast}
                min={0}
                max={rules.keepScoreAtLeast}
                suffix="%"
                onChange={(reviewScoreAtLeast) =>
                  updateRules({ ...rules, reviewScoreAtLeast })
                }
              />
              <ToggleField
                label={t("triage.protectLocked")}
                description={t("triage.protectLockedHelp")}
                checked={rules.protectLocked}
                onChange={(protectLocked) =>
                  updateRules({ ...rules, protectLocked })
                }
              />
              <ToggleField
                label={t("triage.protectEquipped")}
                description={t("triage.protectEquippedHelp")}
                checked={rules.protectEquipped}
                onChange={(protectEquipped) =>
                  updateRules({ ...rules, protectEquipped })
                }
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-select p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-sm">
                    {t("triage.managerTitle")}
                  </CardTitle>
                  <CardDescription className="max-w-3xl text-xs">
                    {t("triage.managerHelp")}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={managerBusy}
                    onClick={() => void createPreview()}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    {managerBusy
                      ? t("triage.managerPreparing")
                      : t("triage.managerPreview")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!managerPreview}
                    onClick={downloadPreview}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    {t("triage.managerDownload")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden
                />
                <p className="leading-6 text-muted-foreground">
                  {t("triage.managerBoundary")}
                </p>
              </div>
              {managerError && (
                <StatusBanner message={managerError} tone="error" />
              )}
              {managerPreview && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <PreviewMetric
                    label={t("triage.managerInstructions")}
                    value={managerActionability?.instructions.length ?? 0}
                  />
                  <PreviewMetric
                    label={t("triage.managerPreviewOnly")}
                    value={managerActionability?.previewOnlyCount ?? 0}
                  />
                  <PreviewMetric
                    label={t("triage.managerExecutable")}
                    value={managerActionability?.actionableCount ?? 0}
                  />
                  <PreviewMetric
                    label={t("triage.managerReasonUnknownBefore")}
                    value={
                      managerActionability?.reasonCounts["unknown-before"] ?? 0
                    }
                  />
                  <PreviewMetric
                    label={t("triage.managerReasonEquipped")}
                    value={managerActionability?.reasonCounts.equipped ?? 0}
                  />
                  <PreviewMetric
                    label={t("triage.managerReasonLocked")}
                    value={managerActionability?.reasonCounts.locked ?? 0}
                  />
                  <PreviewMetric
                    label={t("triage.managerReasonAmbiguous")}
                    value={
                      managerActionability?.reasonCounts["ambiguous-matcher"] ??
                      0
                    }
                  />
                  <PreviewMetric
                    label={t("triage.managerBlockedLockedDiscard")}
                    value={managerPreview.omittedInstructionIds.length}
                  />
                  <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-4">
                    {(managerActionability?.instructions.length ?? 0) === 0
                      ? t("triage.managerNoInstructions")
                      : (managerActionability?.previewOnlyCount ?? 0) > 0
                        ? t("triage.managerReasonHelp")
                        : t("triage.managerFreshEvidence")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-select p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-sm">
                      {t("triage.resultsTitle")}
                    </CardTitle>
                    <CardDescription className="space-y-1 text-xs">
                      <span className="block">{t("triage.resultsHelp")}</span>
                      <span className="block tabular-nums">
                        {t("triage.visibleCount", {
                          shown: visible.length,
                          total: summary.total,
                        })}
                      </span>
                    </CardDescription>
                  </div>
                  <SelectField
                    label={t("triage.filterSlot")}
                    value={slotFilter}
                    options={slotOptions}
                    onChange={(value) => setSlotFilter(value as SlotFilter)}
                    className="w-full sm:w-48"
                  />
                </div>
                <fieldset className="flex flex-wrap items-center gap-2">
                  <legend className="mr-2 text-xs font-medium text-muted-foreground">
                    {t("triage.filterLabel")}
                  </legend>
                  <ChoiceChip
                    selected={decisionFilter === "all"}
                    onClick={() => setDecisionFilter("all")}
                  >
                    {t("triage.all")}
                  </ChoiceChip>
                  {DECISIONS.map((decision) => (
                    <ChoiceChip
                      key={decision}
                      selected={decisionFilter === decision}
                      onClick={() => setDecisionFilter(decision)}
                    >
                      {decisionLabel(decision, t)}
                    </ChoiceChip>
                  ))}
                </fieldset>
                <fieldset className="flex flex-wrap items-center gap-2">
                  <legend className="mr-2 text-xs font-medium text-muted-foreground">
                    {t("triage.filterCategory")}
                  </legend>
                  <ChoiceChip
                    selected={categoryFilter === "all"}
                    onClick={() => setCategoryFilter("all")}
                  >
                    {t("triage.all")}
                  </ChoiceChip>
                  <ChoiceChip
                    selected={categoryFilter === "cavern"}
                    onClick={() => setCategoryFilter("cavern")}
                  >
                    {t("triage.category.cavern")}
                    <Badge variant="outline" className="tabular-nums">
                      {summary.categories.cavern}
                    </Badge>
                  </ChoiceChip>
                  <ChoiceChip
                    selected={categoryFilter === "planar"}
                    onClick={() => setCategoryFilter("planar")}
                  >
                    {t("triage.category.planar")}
                    <Badge variant="outline" className="tabular-nums">
                      {summary.categories.planar}
                    </Badge>
                  </ChoiceChip>
                </fieldset>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((evaluation) => (
                <TriageRelic
                  key={evaluation.relic.key}
                  evaluation={evaluation}
                  references={data}
                />
              ))}
              {visible.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" aria-hidden />
                  {t("triage.noResults")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TriageRelic({
  evaluation,
  references,
}: {
  evaluation: RelicTriageEvaluation;
  references: NonNullable<ReturnType<typeof useBuildReferences>["data"]>;
}) {
  const { locale, t } = useI18n();
  const category = relicCategory(evaluation.relic.slot);
  return (
    <RelicScoreCard
      relic={evaluation.relic}
      score={{ total: evaluation.score, grade: evaluation.grade }}
      references={references}
      locale={locale}
      selected={evaluation.result.decision === "keep"}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={decisionVariant(evaluation.result.decision)}>
            {decisionLabel(evaluation.result.decision, t)}
          </Badge>
          <Badge variant="outline">
            {category === "cavern"
              ? t("triage.category.cavern")
              : t("triage.category.planar")}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {evaluation.result.reasons.map((reason) => (
            <Badge key={reason} variant="outline">
              {reasonLabel(reason, t)}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("triage.matchingBuilds", {
            count: evaluation.matchingBuildIds.length,
          })}
        </p>
      </div>
    </RelicScoreCard>
  );
}

function decisionVariant(decision: TriageDecision): "secondary" | "outline" {
  return decision === "keep" ? "secondary" : "outline";
}

function decisionLabel(
  decision: TriageDecision,
  t: ReturnType<typeof useI18n>["t"]
): string {
  if (decision === "keep") return t("triage.keep");
  if (decision === "review") return t("triage.review");
  return t("triage.salvageReview");
}

function reasonLabel(
  reason: TriageReason,
  t: ReturnType<typeof useI18n>["t"]
): string {
  switch (reason) {
    case "locked":
      return t("triage.reason.locked");
    case "equipped":
      return t("triage.reason.equipped");
    case "lock-state-unknown":
      return t("triage.reason.unknownLock");
    case "no-builds":
      return t("triage.reason.noBuilds");
    case "build-match":
      return t("triage.reason.buildMatch");
    case "no-build-match":
      return t("triage.reason.noBuildMatch");
    case "keep-score":
      return t("triage.reason.keepScore");
    case "review-score":
      return t("triage.reason.reviewScore");
    case "low-score":
      return t("triage.reason.lowScore");
  }
}
