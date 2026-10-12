import { BattleSetupCard } from "@/components/teams/team/BattleSetupCard";
import { RosterCard } from "@/components/teams/team/RosterCard";
import { TeamDetailFrame } from "@/components/teams/team/TeamDetailFrame";
import { useTeamDmgData } from "@/components/teams/team/TeamDmgData";
import type { TeamDetailProps } from "@/components/teams/team/types";
import { useTeamSimulation } from "@/hooks/useTeamSimulation";
import { ChoiceResultsCard } from "./ChoiceResultsCard";

/**
 * Light Cone & Relic Choice team detail: roster, battle setup, then each
 * member's ranking of Light Cones or Relic set plans.
 */
export function ChoiceDetail({ team, onBack }: TeamDetailProps) {
  const { sources } = useTeamDmgData();
  const simulation = useTeamSimulation(team, sources);
  return (
    <TeamDetailFrame team={team} tab="choice" onBack={onBack}>
      <RosterCard team={team} outcomes={simulation.result?.members ?? null} />
      <BattleSetupCard team={team} />
      <ChoiceResultsCard key={team.id} team={team} />
    </TeamDetailFrame>
  );
}
