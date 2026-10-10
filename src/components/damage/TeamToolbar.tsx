import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  NumberField,
  SelectField,
  TextField,
} from "@/components/builds/BuildControls";
import { ConfirmDialog } from "@/components/builds/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";
import {
  SCENARIO_LABEL_KEYS,
  type ScenarioPresetId,
} from "@/lib/combat/presentation";
import type { TeamPlan } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

export function teamDisplayName(
  team: TeamPlan,
  teams: readonly TeamPlan[],
  t: ReturnType<typeof useI18n>["t"]
): string {
  return (
    team.name ??
    t("combat.team.unnamed", {
      index: teams.findIndex((entry) => entry.id === team.id) + 1,
    })
  );
}

export function TeamToolbar({
  team,
  teams,
}: {
  team: TeamPlan;
  teams: readonly TeamPlan[];
}) {
  const { t } = useI18n();
  const createTeam = useTeamStore((state) => state.createTeam);
  const duplicateTeam = useTeamStore((state) => state.duplicateTeam);
  const removeTeam = useTeamStore((state) => state.removeTeam);
  const setActiveTeam = useTeamStore((state) => state.setActiveTeam);
  const renameTeam = useTeamStore((state) => state.renameTeam);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = teamDisplayName(team, teams, t);

  return (
    <div className="flex flex-wrap items-end gap-3" data-team-toolbar>
      <SelectField
        className="w-44"
        label={t("combat.team.select")}
        value={team.id}
        options={teams.map((entry) => ({
          value: entry.id,
          label: teamDisplayName(entry, teams, t),
        }))}
        onChange={setActiveTeam}
      />
      <TextField
        className="w-44"
        label={t("combat.team.name")}
        value={name}
        onChange={(value) => renameTeam(team.id, value)}
      />
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("combat.team.new")}
          title={t("combat.team.new")}
          onClick={() => createTeam()}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("combat.team.duplicate")}
          title={t("combat.team.duplicate")}
          onClick={() => duplicateTeam(team.id)}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("combat.team.delete")}
          title={t("combat.team.delete")}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <SelectField
        className="w-40"
        label={t("combat.scenario")}
        value={team.scenario}
        options={(Object.keys(SCENARIO_LABEL_KEYS) as ScenarioPresetId[]).map(
          (id) => ({ value: id, label: t(SCENARIO_LABEL_KEYS[id]) })
        )}
        onChange={(value) =>
          updateTeam(team.id, { scenario: value as ScenarioPresetId })
        }
      />
      <NumberField
        className="w-24"
        label={t("combat.cycles")}
        value={team.cycles}
        min={1}
        max={30}
        onChange={(cycles) => updateTeam(team.id, { cycles })}
      />
      <NumberField
        className="w-24"
        label={t("combat.enemyLevel")}
        value={team.enemyLevel}
        min={1}
        max={120}
        onChange={(enemyLevel) => updateTeam(team.id, { enemyLevel })}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("combat.team.delete")}
        description={t("combat.team.deleteConfirm", { name })}
        confirmLabel={t("combat.team.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => {
          removeTeam(team.id);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
