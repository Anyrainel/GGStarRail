import { Download, Unlink, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PageActionButton } from "@/components/layout/PageActions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PresetImportDialog } from "@/components/shared/PresetImportDialog";
import { StatusBanner } from "@/components/shared/StatusBanner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nContext";
import { characterCatalogName } from "@/services/catalog/presentation";
import { clearResultCache } from "@/services/combat/resultCache";
import {
  createTeamWorkspaceBundle,
  parseTeamWorkspaceBundle,
  type TeamWorkspaceBundle,
  teamBundleReferenceIssue,
} from "@/services/teams/bundle";
import { loadTeamPreset, TEAM_PRESET_OPTIONS } from "@/services/teams/presets";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTeamDmgData } from "./TeamDmgData";
import { teamDisplayName } from "./teamNames";

/** Import/export controls shared by the app bar and its narrow-screen menu. */
export function useTeamWorkspaceActions() {
  const { locale, t } = useI18n();
  const { references } = useTeamDmgData();
  const teams = useTeamStore((state) => state.teams);
  const subscription = useTeamStore((state) => state.presetSubscription);
  const inputRef = useRef<HTMLInputElement>(null);
  const importRequest = useRef(0);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TeamWorkspaceBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [loadingPreset, setLoadingPreset] = useState(false);

  function review(bundle: TeamWorkspaceBundle) {
    const issue = teamBundleReferenceIssue(bundle, references);
    if (issue) {
      setPending(null);
      setOpen(false);
      setError(t("teamDmg.importReferenceError", { id: issue }));
      return;
    }
    setError(null);
    setPending(bundle);
    setOpen(false);
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    const request = ++importRequest.current;
    setPresetId(null);
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      if (request === importRequest.current)
        review(parseTeamWorkspaceBundle(text));
    } catch {
      if (request === importRequest.current) setError(t("teamDmg.importError"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  function exportTeams() {
    try {
      const { teams, activeTeamId, analysisByTeamId, presetSubscription } =
        useTeamStore.getState();
      const bundle = createTeamWorkspaceBundle({
        teams,
        activeTeamId,
        analysisByTeamId,
        presetSubscription,
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(bundle, null, 2)], {
          type: "application/json",
        })
      );
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "ggstarrail-teams.json";
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError(t("teamDmg.exportError"));
    }
  }
  const primary = (
    <>
      <PageActionButton
        icon={Upload}
        label={t("teamDmg.import")}
        onClick={() => setOpen(true)}
      />
      <PageActionButton
        icon={Download}
        label={t("teamDmg.export")}
        disabled={!teams.length}
        onClick={exportTeams}
      />
    </>
  );
  const overflow = (
    <>
      {subscription && (
        <DropdownMenuItem
          onSelect={() => useTeamStore.getState().stopPresetSubscription()}
        >
          <Unlink className="h-4 w-4" aria-hidden />
          {t("teamDmg.stopSubscription")}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem className="sm:hidden" onSelect={() => setOpen(true)}>
        <Upload className="h-4 w-4" aria-hidden />
        {t("teamDmg.import")}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="sm:hidden"
        disabled={!teams.length}
        onSelect={exportTeams}
      >
        <Download className="h-4 w-4" aria-hidden />
        {t("teamDmg.export")}
      </DropdownMenuItem>
    </>
  );
  const dialogs = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label={t("teamDmg.importFile")}
        onChange={(event) => void importFile(event.target.files?.[0])}
      />
      <PresetImportDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            importRequest.current++;
            setLoadingPreset(false);
          }
        }}
        title={t("teamDmg.import")}
        options={TEAM_PRESET_OPTIONS.map((option) => ({
          id: option.id,
          label: t(option.labelKey),
        }))}
        disabled={loadingPreset}
        selectedId={subscription?.presetId}
        onDetach={
          subscription
            ? () => {
                useTeamStore.getState().stopPresetSubscription();
                setOpen(false);
              }
            : undefined
        }
        onLocalImport={() => {
          setPresetId(null);
          setOpen(false);
          inputRef.current?.click();
        }}
        onSelect={(id) => {
          const request = ++importRequest.current;
          setLoadingPreset(true);
          setPresetId(id);
          void loadTeamPreset(id)
            .then((preset) => {
              if (request !== importRequest.current) return;
              try {
                const teams = preset.teams;
                review(
                  createTeamWorkspaceBundle({
                    teams,
                    activeTeamId: teams[0]?.id ?? null,
                    analysisByTeamId: {},
                  })
                );
              } catch {
                setError(t("teamDmg.importError"));
                setOpen(false);
              }
            })
            .catch(() => {
              if (request !== importRequest.current) return;
              setError(t("teamDmg.importError"));
              setOpen(false);
            })
            .finally(() => {
              if (request === importRequest.current) setLoadingPreset(false);
            });
        }}
      />
      <ConfirmDialog
        open={pending !== null || error !== null}
        onOpenChange={(value) => {
          if (!value) {
            setPending(null);
            setError(null);
          }
        }}
        title={t("teamDmg.importReview")}
        description={
          error ??
          t("teamDmg.importConfirm", { count: pending?.teams.length ?? 0 })
        }
        confirmLabel={
          error
            ? t("common.cancel")
            : presetId
              ? t("teamDmg.subscribeApply")
              : t("teamDmg.importApply")
        }
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          if (pending && !error) {
            clearResultCache();
            if (presetId)
              useTeamStore.getState().subscribePreset(presetId, pending.teams);
            else useTeamStore.getState().replaceTeams(pending);
            setPending(null);
          }
          setError(null);
        }}
      >
        {error ? (
          <StatusBanner message={error} tone="error" />
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2">
            {pending?.teams.map((team) => (
              <div
                key={team.id}
                className="rounded-md border border-border px-3 py-2"
              >
                <div className="font-medium">
                  {teamDisplayName(team, pending?.teams ?? [], t)}
                </div>
                <div className="text-sm">
                  {team.members
                    .flatMap((member) => {
                      if (!member) return [];
                      const character = references.characters.byId.get(
                        member.characterId
                      );
                      return [
                        character
                          ? characterCatalogName(
                              character,
                              locale,
                              t("terms.trailblazer")
                            )
                          : member.characterId,
                      ];
                    })
                    .join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
  return { primary, overflow, dialogs };
}
