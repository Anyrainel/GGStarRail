import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageActionButton, PageActions } from "@/components/layout/PageActions";
import { ExportIcon, ImportIcon } from "@/components/shared/importExportIcons";
import { PresetImportDialog } from "@/components/shared/PresetImportDialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildWorkspaceBundle } from "@/services/builds/bundle";
import {
  parseBuildWorkspaceBundle,
  serializeBuildWorkspaceBundle,
} from "@/services/builds/bundle";
import { loadInGameBuildPreset } from "@/services/builds/presets";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import type { StatusTone } from "../shared/StatusBanner";

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
  if (bundle.buildPresetSubscription) {
    const baselineIssue = referenceImportIssue(
      {
        ...bundle,
        ...bundle.buildPresetSubscription.baseline,
        buildPresetSubscription: null,
      },
      references,
      t
    );
    if (baselineIssue) return baselineIssue;
  }
  for (const [characterId, coneIds] of Object.entries(
    bundle.characterLightConeIds
  )) {
    const character = references.characters.byId.get(characterId);
    if (!character) return t("build.importIssueCharacter", { id: characterId });
    for (const id of coneIds) {
      const cone = references.lightCones.byId.get(id);
      if (!cone || cone.path_id !== character.path_id)
        return t("build.importIssueLightCone", { id });
    }
  }
  for (const build of bundle.builds) {
    if (!references.characters.byId.has(build.characterDefinitionId)) {
      return t("build.importIssueCharacter", {
        id: build.characterDefinitionId,
      });
    }
    if (build.category === "cavern") {
      const cavernIds =
        build.cavern.mode === "four-piece"
          ? [build.cavern.setId]
          : build.cavern.setIds;
      for (const setId of cavernIds) {
        if (references.relicSets.byId.get(setId)?.kind !== "cavern_relic") {
          return t("build.importIssueCavernSet", { id: setId });
        }
      }
    } else if (
      references.relicSets.byId.get(build.planarSetId)?.kind !==
      "planar_ornament"
    ) {
      return t("build.importIssuePlanarSet", { id: build.planarSetId });
    }
    for (const [slot, selected] of Object.entries(build.preferredMainStats)) {
      const catalogSlot = MAIN_STAT_SLOTS[slot as keyof typeof MAIN_STAT_SLOTS];
      const accepted = new Set(
        references.properties.relicSlotById.get(catalogSlot)
          ?.valid_main_properties ?? []
      );
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
  const subscription = useWorkspaceStore(
    (state) => state.buildPresetSubscription
  );
  const characterLightConeIds = useWorkspaceStore(
    (state) => state.characterLightConeIds
  );
  const scoreProfiles = useWorkspaceStore((state) => state.scoreProfiles);
  const triageRules = useWorkspaceStore((state) => state.triageRules);
  const replaceBuildWorkspace = useWorkspaceStore(
    (state) => state.replaceBuildWorkspace
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] =
    useState<BuildWorkspaceBundle | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  function setStatus(status: WorkspaceStatus | null) {
    if (status) toast[status.tone](status.message);
  }

  function exportWorkspace() {
    const json = serializeBuildWorkspaceBundle({
      builds,
      characterLightConeIds,
      scoreProfiles,
      triageRules,
      buildPresetSubscription:
        useWorkspaceStore.getState().buildPresetSubscription,
    });
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ggartifact-hsr-build-workspace.json";
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
      setPendingPresetId(null);
      setImportOpen(false);
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

  async function reviewPreset() {
    setPresetLoading(true);
    try {
      const bundle = await loadInGameBuildPreset();
      if (!references) {
        throw new BuildImportReviewError(t("build.importReferenceUnavailable"));
      }
      const issue = referenceImportIssue(bundle, references, t);
      if (issue) throw new BuildImportReviewError(issue);
      setPendingImport(bundle);
      setPendingPresetId("in-game");
      setImportOpen(false);
    } catch (reason: unknown) {
      setStatus({
        tone: "error",
        message:
          reason instanceof BuildImportReviewError
            ? reason.message
            : t("build.importError"),
      });
    } finally {
      setPresetLoading(false);
    }
  }

  function applyImport() {
    if (!pendingImport) return;
    if (pendingPresetId)
      useWorkspaceStore
        .getState()
        .subscribeBuildPreset(pendingPresetId, pendingImport);
    else
      replaceBuildWorkspace({
        builds: pendingImport.builds,
        characterLightConeIds: pendingImport.characterLightConeIds,
        scoreProfiles: pendingImport.scoreProfiles,
        triageRules: pendingImport.triageRules,
        buildPresetSubscription: pendingImport.buildPresetSubscription,
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
      characterLightConeIds: {},
      scoreProfiles: [],
      triageRules: structuredClone(DEFAULT_WORKSPACE.triageRules),
    });
    setStatus({ tone: "success", message: t("build.cleared") });
  }

  const hasWorkspace =
    builds.length > 0 ||
    scoreProfiles.length > 0 ||
    Object.values(characterLightConeIds).some((ids) => ids.length > 0);

  return (
    <>
      <PageActions
        primary={
          <PageActionButton
            icon={ImportIcon}
            label={t("common.import")}
            onClick={() => setImportOpen(true)}
          />
        }
        overflow={
          <>
            <DropdownMenuItem
              className="sm:hidden"
              onSelect={() => setImportOpen(true)}
            >
              <ImportIcon className="h-4 w-4" aria-hidden="true" />
              {t("common.import")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasWorkspace}
              onSelect={exportWorkspace}
            >
              <ExportIcon className="h-4 w-4" aria-hidden="true" />
              {t("common.export")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasWorkspace}
              className="text-destructive focus:text-destructive"
              onSelect={() => setClearOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("build.clear")}
            </DropdownMenuItem>
          </>
        }
      />
      <PresetImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title={t("build.import")}
        options={[{ id: "in-game", label: t("build.presetInGame") }]}
        onSelect={() => void reviewPreset()}
        onLocalImport={() => inputRef.current?.click()}
        disabled={presetLoading}
        selectedId={subscription?.presetId}
        onDetach={() => useWorkspaceStore.getState().detachBuildPreset()}
      />
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        aria-label={t("build.import")}
        className="sr-only"
        onChange={(event) => void reviewImport(event.target.files?.[0])}
      />
      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
        title={t("build.importReviewTitle")}
        description={
          pendingPresetId
            ? t("build.presetConfirm", { count: builds.length })
            : t("build.importConfirm", {
                count: pendingImport?.builds.length ?? 0,
              })
        }
        confirmLabel={
          pendingPresetId ? t("preset.subscribe") : t("build.importApply")
        }
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
