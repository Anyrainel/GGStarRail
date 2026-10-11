import { useState } from "react";
import { BattleSetupCard } from "@/components/damage/team/BattleSetupCard";
import { RosterCard } from "@/components/damage/team/RosterCard";
import { TeamDetailFrame } from "@/components/damage/team/TeamDetailFrame";
import { useTeamDmgData } from "@/components/damage/team/TeamDmgData";
import type { TeamDetailProps } from "@/components/damage/team/types";
import type { CritMode } from "@/domain/combat/model/formulas";
import { useTeamSimulation } from "@/hooks/useTeamSimulation";
import { BattleTimelineCard } from "./BattleTimelineCard";
import { RelicsDamageCard } from "./RelicsDamageCard";

/**
 * DMG Optimizer team detail: roster, battle setup, the simulated timeline,
 * then the team's Relics and damage (current, optimized or ideal).
 */
export function OptimizerDetail({ team, onBack }: TeamDetailProps) {
  const { sources } = useTeamDmgData();
  const [critMode, setCritMode] = useState<CritMode>("expected");
  const simulation = useTeamSimulation(team, sources, { critMode });
  return (
    <TeamDetailFrame team={team} tab="optimizer" onBack={onBack}>
      <RosterCard team={team} outcomes={simulation.result?.members ?? null} />
      <BattleSetupCard team={team} />
      <BattleTimelineCard
        result={simulation.result}
        running={simulation.running}
        failed={simulation.failed}
      />
      <RelicsDamageCard
        key={team.id}
        team={team}
        simulation={simulation}
        critMode={critMode}
        onCritModeChange={setCritMode}
      />
    </TeamDetailFrame>
  );
}
