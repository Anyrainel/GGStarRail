import type { SimulateResponse } from "@/services/combat/jobs";
import { BattleTimelineCard } from "../optimizer/BattleTimelineCard";

export function RotationPanel({
  result,
  running,
  failed,
}: {
  result: SimulateResponse | null;
  running: boolean;
  failed: boolean;
}) {
  return (
    <BattleTimelineCard
      result={result}
      running={running}
      failed={failed}
      collapsible={false}
    />
  );
}
