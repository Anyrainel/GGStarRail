import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildWorkspaceBundle } from "@/lib/buildBundle";
import {
  parseBuildWorkspaceBundle,
  serializeBuildWorkspaceBundle,
} from "@/lib/buildBundle";
import type { BuildReferences } from "@/lib/buildReferences";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { StatusBanner, type StatusTone } from "./StatusBanner";

interface WorkspaceStatus {
  tone: StatusTone;
  message: string;
}

const MAIN_STAT_SLOTS = {
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const;

class BuildImportReviewError extends Error {}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function structuralImportIssue(
  input: unknown,
  t: ReturnType<typeof useI18n>["t"]
): string | null {
  if (!isRecord(input)) return null;
  const rawBuilds = Array.isArray(input.builds) ? input.builds : [];
  const rawProfiles = Array.isArray(input.scoreProfiles)
    ? input.scoreProfiles
    : [];
  const seenIds = new Set<string>();
  for (const entry of [...rawBuilds, ...rawProfiles]) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    if (seenIds.has(entry.id)) {
      return t("build.importIssueDuplicateId", { id: entry.id });
    }
    seenIds.add(entry.id);
  }

  const profileIds = new Set(
    rawProfiles.flatMap((entry) =>
      isRecord(entry) && typeof entry.id === "string" ? [entry.id] : []
    )
  );
  for (const entry of rawBuilds) {
    if (
      isRecord(entry) &&
      typeof entry.scoreProfileId === "string" &&
      !profileIds.has(entry.scoreProfileId)
    ) {
      return t("build.importIssueOrphanProfile", {
        id: entry.scoreProfileId,
      });
    }
  }

  for (const entry of rawProfiles) {
    if (!isRecord(entry) || !isRecord(entry.gradeThresholds)) continue;
    for (const value of Object.values(entry.gradeThresholds)) {
      if (typeof value === "number" && (value < 0 || value > 100)) {
        return t("build.importIssueThreshold");
      }
    }
  }
  if (isRecord(input.triageRules)) {
    const keep = input.triageRules.keepScoreAtLeast;
    const review = input.triageRules.reviewScoreAtLeast;
    if (
      (typeof keep === "number" && (keep < 0 || keep > 100)) ||
      (typeof review === "number" && (review < 0 || review > 100)) ||
      (typeof keep === "number" && typeof review === "number" && keep < review)
    ) {
      return t("build.importIssueThreshold");
    }
  }
  return null;
}

function referenceImportIssue(
  bundle: BuildWorkspaceBundle,
  references: BuildReferences,
  t: ReturnType<typeof useI18n>["t"]
): string | null {
  for (const build of bundle.builds) {
    if (!references.characters.byId.has(build.characterDefinitionId)) {
      return t("build.importIssueCharacter", {
        id: build.characterDefinitionId,
      });
    }
    const cavernIds =
      build.cavern.mode === "four-piece"
        ? [build.cavern.setId]
        : build.cavern.setIds;
    for (const setId of cavernIds) {
      if (references.relicSets.byId.get(setId)?.kind !== "cavern_relic") {
        return t("build.importIssueCavernSet", { id: setId });
      }
    }
    if (
      references.relicSets.byId.get(build.planarSetId)?.kind !==
      "planar_ornament"
    ) {
      return t("build.importIssuePlanarSet", { id: build.planarSetId });
    }
    for (const [slot, catalogSlot] of Object.entries(MAIN_STAT_SLOTS)) {
      const accepted = new Set(
        references.properties.relicSlotById.get(catalogSlot)
          ?.valid_main_properties ?? []
      );
      const selected =
        build.preferredMainStats[
          slot as keyof BuildWorkspaceBundle["builds"][number]["preferredMainStats"]
        ];
      const invalid = selected.find((propertyId) => !accepted.has(propertyId));
      if (invalid) {
        return t("build.importIssueMainStat", { id: invalid });
      }
    }
  }
  return null;
}

export function BuildWorkspaceActions({
  references,
}: {
  references: BuildReferences | null;
}) {
  const { t } = useI18n();
  const builds = useWorkspaceStore((state) => state.builds);
  const scoreProfiles = useWorkspaceStore((state) => state.scoreProfiles);
  const triageRules = useWorkspaceStore((state) => state.triageRules);
  const replaceBuildWorkspace = useWorkspaceStore(
    (state) => state.replaceBuildWorkspace
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] =
    useState<BuildWorkspaceBundle | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);

  function exportWorkspace() {
    const json = serializeBuildWorkspaceBundle({
      builds,
      scoreProfiles,
      triageRules,
    });
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ggstarrail-build-workspace.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus({ tone: "success", message: t("build.exported") });
  }

  async function reviewImport(file: File | undefined) {
    if (!file) return;
    try {
      const text = await readFileText(file);
      const raw: unknown = JSON.parse(text);
      const structuralIssue = structuralImportIssue(raw, t);
      if (structuralIssue) throw new BuildImportReviewError(structuralIssue);
      const bundle = parseBuildWorkspaceBundle(text);
      if (!references) {
        throw new BuildImportReviewError(t("build.importReferenceUnavailable"));
      }
      const referenceIssue = referenceImportIssue(bundle, references, t);
      if (referenceIssue) throw new BuildImportReviewError(referenceIssue);
      setPendingImport(bundle);
      setStatus(null);
    } catch (reason: unknown) {
      setStatus({
        tone: "error",
        message:
          reason instanceof BuildImportReviewError
            ? reason.message
            : t("build.importError"),
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function applyImport() {
    if (!pendingImport) return;
    replaceBuildWorkspace({
      builds: pendingImport.builds,
      scoreProfiles: pendingImport.scoreProfiles,
      triageRules: pendingImport.triageRules,
    });
    setStatus({
      tone: "success",
      message: t("build.imported", { count: pendingImport.builds.length }),
    });
    setPendingImport(null);
  }

  function clearWorkspace() {
    replaceBuildWorkspace({
      builds: [],
      scoreProfiles: [],
      triageRules: structuredClone(DEFAULT_WORKSPACE.triageRules),
    });
    setStatus({ tone: "success", message: t("build.cleared") });
  }

  const hasWorkspace = builds.length > 0 || scoreProfiles.length > 0;

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("build.backupTitle")}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              {t("build.workspaceSummary", {
                builds: builds.length,
                profiles: scoreProfiles.length,
              })}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t("build.import")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasWorkspace}
              onClick={exportWorkspace}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("build.export")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!hasWorkspace}
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("build.clear")}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              aria-label={t("build.import")}
              className="sr-only"
              onChange={(event) => void reviewImport(event.target.files?.[0])}
            />
          </div>
        </CardContent>
        {status && (
          <CardContent className="border-t border-border p-3">
            <StatusBanner message={status.message} tone={status.tone} />
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
        title={t("build.importReviewTitle")}
        description={t("build.importConfirm", {
          count: pendingImport?.builds.length ?? 0,
        })}
        confirmLabel={t("build.importApply")}
        cancelLabel={t("common.cancel")}
        onConfirm={applyImport}
      />
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t("build.clear")}
        description={t("build.clearConfirm")}
        confirmLabel={t("build.clear")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={clearWorkspace}
      />
    </>
  );
}
