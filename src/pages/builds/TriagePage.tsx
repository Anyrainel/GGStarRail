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
import { NumberField, ToggleField } from "@/components/builds/BuildControls";
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
  evaluateAccountTriage,
  type RelicTriageEvaluation,
} from "@/domain/build/evaluation";
import type { TriageRules } from "@/domain/build/schemas";
import type { TriageDecision, TriageReason } from "@/domain/build/triage";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { createRelicScoringContext } from "@/lib/buildReferences";
import {
  createManagerInstructionPreview,
  type ManagerInstructionPreview,
  serializeManagerInstructionEnvelope,
} from "@/lib/managerInstructions";
import { HSR_REFERENCE_MANIFEST } from "@/providers/gilore/catalog";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

type DecisionFilter = "all" | TriageDecision;

export default function TriagePage() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const rules = useWorkspaceStore((state) => state.triageRules);
  const setRules = useWorkspaceStore((state) => state.setTriageRules);
  const { data, error, loading } = useBuildReferences();
  const [filter, setFilter] = useState<DecisionFilter>("all");
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

  const counts = useMemo(
    () => ({
      all: evaluations.length,
      keep: evaluations.filter(({ result }) => result.decision === "keep")
        .length,
      review: evaluations.filter(({ result }) => result.decision === "review")
        .length,
      "salvage-review": evaluations.filter(
        ({ result }) => result.decision === "salvage-review"
      ).length,
    }),
    [evaluations]
  );
  const visible = evaluations.filter(
    ({ result }) => filter === "all" || result.decision === filter
  );
  const managerActionability = managerPreview?.actionability ?? null;

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
        <>
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-3">
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-sm">
                    {t("triage.resultsTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("triage.resultsHelp")}
                  </CardDescription>
                </div>
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">{t("triage.filterLabel")}</legend>
                  {(
                    [
                      ["all", t("triage.all")],
                      ["keep", t("triage.keep")],
                      ["review", t("triage.review")],
                      ["salvage-review", t("triage.salvageReview")],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={filter === value ? "secondary" : "outline"}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                      <Badge variant="outline" className="tabular-nums">
                        {counts[value]}
                      </Badge>
                    </Button>
                  ))}
                </fieldset>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.slice(0, 60).map((evaluation) => (
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
              {visible.length > 60 && (
                <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
                  {t("triage.showingFirst", {
                    shown: 60,
                    total: visible.length,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </>
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
  return (
    <RelicScoreCard
      relic={evaluation.relic}
      score={{ total: evaluation.score, grade: evaluation.grade }}
      references={references}
      locale={locale}
      selected={evaluation.result.decision === "keep"}
    >
      <div className="space-y-2">
        <Badge variant={decisionVariant(evaluation.result.decision)}>
          {decisionLabel(evaluation.result.decision, t)}
        </Badge>
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
  if (decision === "keep") return "secondary";
  return "outline";
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
