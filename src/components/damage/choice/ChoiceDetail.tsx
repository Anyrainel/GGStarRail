import { BattleSetupCard } from "@/components/damage/team/BattleSetupCard";
import { RosterCard } from "@/components/damage/team/RosterCard";
import { TeamDetailFrame } from "@/components/damage/team/TeamDetailFrame";
import { useTeamDmgData } from "@/components/damage/team/TeamDmgData";
import type { TeamDetailProps } from "@/components/damage/team/types";
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
