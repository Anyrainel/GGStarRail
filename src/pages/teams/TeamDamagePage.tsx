import { Gem, Medal, Repeat2, TrendingUp, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import { getCombatTypeColor } from "@/components/shared/colors";
import { PageHeader } from "@/components/shared/PageHeader";
import { CharacterReplacementCard } from "@/components/teams/characters/CharacterReplacementCard";
import { ChoiceResultsCard } from "@/components/teams/choice/ChoiceResultsCard";
import { InvestmentDetail } from "@/components/teams/investment/InvestmentDetail";
import { RelicsDamageCard } from "@/components/teams/optimizer/RelicsDamageCard";
import { RotationPanel } from "@/components/teams/rotation/RotationPanel";
import { BattleSetupCard } from "@/components/teams/team/BattleSetupCard";
import {
  OptionButton,
  OptionButtonRow,
} from "@/components/teams/team/OptionButton";
import { RosterCard } from "@/components/teams/team/RosterCard";
import { TeamDetailFrame } from "@/components/teams/team/TeamDetailFrame";
import {
  TeamDmgDataProvider,
  useTeamDmgData,
} from "@/components/teams/team/TeamDmgData";
import { TeamGrid } from "@/components/teams/team/TeamGrid";
import { useTeamParam } from "@/components/teams/team/useTeamParam";
import type { CritMode } from "@/domain/combat/model/formulas";
import {
  ANALYSIS_MODES,
  type AnalysisMode,
  AnalysisModeSchema,
} from "@/domain/team/analysis";
import type { TeamPlan } from "@/domain/team/schemas";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useTeamSimulation } from "@/hooks/useTeamSimulation";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/stores/useTeamStore";

const MODE_LABELS = {
  relics: "teamAnalysis.relics",
  builds: "teamAnalysis.builds",
  investment: "teamAnalysis.investment",
  characters: "teamAnalysis.characters",
  rotation: "teamAnalysis.rotation",
} as const;
const MODE_ICONS = {
  relics: Gem,
  builds: Medal,
  investment: TrendingUp,
  characters: UsersRound,
  rotation: Repeat2,
};
const MODE_COLORS = {
  relics: "Ice",
  builds: "Imaginary",
  investment: "Fire",
  characters: "Wind",
  rotation: "Quantum",
};

function TeamModes({
  team,
  active,
  mode,
  onSimulation,
}: {
  team: TeamPlan;
  active: boolean;
  mode: AnalysisMode;
  onSimulation: (
    teamId: string,
    result: ReturnType<typeof useTeamSimulation>
  ) => void;
}) {
  const { sources } = useTeamDmgData();
  const [critMode, setCritMode] = useState<CritMode>("expected");
  const simulation = useTeamSimulation(team, sources, {
    critMode,
    enabled: active,
  });
  useEffect(
    () => onSimulation(team.id, simulation),
    [team.id, simulation, onSimulation]
  );
  return (
    <>
      {ANALYSIS_MODES.map((value) => (
        <div
          key={value}
          hidden={!active || mode !== value}
          data-analysis-mode={value}
        >
          {value === "relics" ? (
            <RelicsDamageCard
              team={team}
              simulation={simulation}
              critMode={critMode}
              onCritModeChange={setCritMode}
            />
          ) : value === "builds" ? (
            <ChoiceResultsCard team={team} />
          ) : value === "investment" ? (
            <InvestmentDetail team={team} />
          ) : value === "characters" ? (
            <CharacterReplacementCard team={team} />
          ) : (
            <RotationPanel
              result={simulation.result}
              running={simulation.running}
              failed={simulation.failed}
            />
          )}
        </div>
      ))}
    </>
  );
}

function TeamDamageContent() {
  const { t } = useI18n();
  const { team, openTeam, closeTeam } = useTeamParam();
  const teams = useTeamStore((s) => s.teams);
  const analysis = useTeamStore((s) => s.analysisByTeamId);
  const setMode = useTeamStore((s) => s.setAnalysisMode);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const parsed = AnalysisModeSchema.safeParse(params.get("mode"));
  const mode = parsed.success
    ? parsed.data
    : team
      ? (analysis[team.id]?.mode ?? "relics")
      : "relics";
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set());
  const [simulations, setSimulations] = useState<
    Record<string, ReturnType<typeof useTeamSimulation>>
  >({});
  const onSimulation = useState(
    () => (id: string, result: ReturnType<typeof useTeamSimulation>) =>
      setSimulations((current) =>
        current[id] === result ? current : { ...current, [id]: result }
      )
  )[0];
  useEffect(() => {
    if (team) {
      setVisited((current) =>
        current.has(team.id) ? current : new Set([...current, team.id])
      );
      if (analysis[team.id]?.mode !== mode) setMode(team.id, mode);
    }
    if (params.get("mode") !== mode)
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("mode", mode);
          return next;
        },
        { replace: true, state: location.state }
      );
  }, [team, mode, analysis, params, setParams, setMode, location.state]);
  const bodies = teams
    .filter((entry) => visited.has(entry.id) || entry.id === team?.id)
    .map((entry) => (
      <TeamModes
        key={entry.id}
        team={entry}
        active={entry.id === team?.id}
        mode={mode}
        onSimulation={onSimulation}
      />
    ));
  const frameTeam = team ?? teams.find((entry) => visited.has(entry.id));
  return (
    <>
      {!team && <TeamGrid onOpen={openTeam} />}
      {frameTeam && (
        <div hidden={!team}>
          <TeamDetailFrame team={frameTeam} onBack={closeTeam}>
            <RosterCard
              team={frameTeam}
              outcomes={simulations[frameTeam.id]?.result?.members ?? null}
            />
            <BattleSetupCard team={frameTeam} />
            <div className="mt-4 [container-type:inline-size] [container-name:analysis-mode]">
              <OptionButtonRow
                label={t("teamAnalysis.mode")}
                className="grid grid-cols-3 gap-1.5 rounded-xl border border-primary/40 bg-gradient-select p-1.5 [@container_analysis-mode_(min-width:36rem)]:grid-cols-5"
              >
                {ANALYSIS_MODES.map((value) => {
                  const Icon = MODE_ICONS[value];
                  return (
                    <OptionButton
                      key={value}
                      selected={mode === value}
                      onSelect={() =>
                        setParams(
                          (current) => {
                            const next = new URLSearchParams(current);
                            next.set("mode", value);
                            return next;
                          },
                          { replace: true, state: location.state }
                        )
                      }
                      className={cn(
                        "min-h-11 justify-center px-2 py-2",
                        mode === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-primary/30 bg-primary/10 text-foreground"
                      )}
                      titleClassName="text-xs md:text-sm lg:text-sm"
                      title={t(MODE_LABELS[value])}
                      icon={
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            getCombatTypeColor(MODE_COLORS[value], "text")
                          )}
                        />
                      }
                    />
                  );
                })}
              </OptionButtonRow>
            </div>
            {bodies}
          </TeamDetailFrame>
        </div>
      )}
    </>
  );
}

export default function TeamDamagePage() {
  const { data, error, loading } = useBuildReferences();
  return (
    <PageLayout>
      <PageHeader titleKey="route.teamDamage.title" visuallyHidden />
      {loading ? (
        <ScrollLayout>
          <CatalogLoading />
        </ScrollLayout>
      ) : error || !data ? (
        <ScrollLayout>
          <CatalogLoadError error={error} />
        </ScrollLayout>
      ) : (
        <TeamDmgDataProvider references={data}>
          <TeamDamageContent />
        </TeamDmgDataProvider>
      )}
    </PageLayout>
  );
}
