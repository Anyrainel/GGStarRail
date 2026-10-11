import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ConfirmDialog } from "@/components/builds/ConfirmDialog";
import { PageActions } from "@/components/layout/PageActions";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nContext";
import { forgetTeamResults } from "@/lib/combat/resultCache";
import type { TeamPlan } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";
import { TeamAspectLinks } from "./TeamAspectLinks";
import { teamDisplayName, teamPlaceholderName } from "./teamNames";
import type { TeamDmgTab } from "./types";
import { useTeamParam } from "./useTeamParam";

function TeamTitle({ team }: { team: TeamPlan }) {
  const { t } = useI18n();
  const teams = useTeamStore((state) => state.teams);
  const renameTeam = useTeamStore((state) => state.renameTeam);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const name = teamDisplayName(team, teams, t);

  if (editing)
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: opened by an explicit rename action
        autoFocus
        value={draft}
        maxLength={80}
        aria-label={t("teamDmg.teamName")}
        placeholder={teamPlaceholderName(team, teams, t)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          renameTeam(team.id, draft);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setEditing(false);
        }}
        className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xl font-black tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-2xl"
      />
    );
  return (
    <h2 className="min-w-0 flex-1 truncate text-xl font-black tracking-tight md:text-2xl">
      <button
        type="button"
        title={t("teamDmg.rename")}
        onClick={() => {
          setDraft(team.name ?? "");
          setEditing(true);
        }}
        className="max-w-full truncate rounded-sm text-left outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        {name}
      </button>
    </h2>
  );
}

/**
 * The shared team detail: back to the grid, the inline-renamable team name,
 * the tab's full-width cards, then links to the same team on the other tabs.
 */
export function TeamDetailFrame({
  team,
  tab,
  onBack,
  children,
}: {
  team: TeamPlan;
  tab: TeamDmgTab;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const teams = useTeamStore((state) => state.teams);
  const duplicateTeam = useTeamStore((state) => state.duplicateTeam);
  const removeTeam = useTeamStore((state) => state.removeTeam);
  const { openTeam } = useTeamParam();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <ScrollLayout>
      <PageActions
        primary={null}
        overflow={
          <>
            <DropdownMenuItem
              onSelect={() => {
                duplicateTeam(team.id);
                const copy = useTeamStore.getState().activeTeamId;
                if (copy && copy !== team.id) openTeam(copy);
              }}
            >
              <Copy className="h-4 w-4" aria-hidden />
              {t("combat.team.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("combat.team.delete")}
            </DropdownMenuItem>
          </>
        }
      />
      <div
        className="flex w-full flex-col gap-1.5 pb-12 duration-300 animate-in fade-in lg:gap-2"
        data-team-detail={tab}
      >
        <div className="flex items-center gap-2 px-0.5 lg:px-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2 h-10 w-10 shrink-0"
            aria-label={t("teamDmg.back")}
            title={t("teamDmg.back")}
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Button>
          <TeamTitle team={team} />
        </div>
        {children}
        <TeamAspectLinks tab={tab} teamId={team.id} />
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("combat.team.delete")}
        description={t("combat.team.deleteConfirm", {
          name: teamDisplayName(team, teams, t),
        })}
        confirmLabel={t("combat.team.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => {
          onBack();
          forgetTeamResults(team.id);
          removeTeam(team.id);
        }}
      />
    </ScrollLayout>
  );
}
