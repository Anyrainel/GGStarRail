import type { BattleOptions } from "./battle/battle";
import type { CombatLog } from "./battle/log";
import { DamageModel, unitPanels } from "./evaluate/damage";
import { buildDamageReport, type DamageReport } from "./evaluate/report";
import type { KitRegistry } from "./kit/registry";
import type { CombatReferenceData } from "./model/data";
import type { CritMode } from "./model/formulas";
import { type AssembledTeam, assembleTeam } from "./team/assemble";
import type { TeamInput } from "./team/input";

export interface SimulationResult {
  readonly team: AssembledTeam;
  readonly log: CombatLog;
  readonly model: DamageModel;
  readonly report: DamageReport;
}

/** Assemble a team, run its battle, and evaluate the hit ledger. */
export function simulateTeam(
  input: TeamInput,
  data: CombatReferenceData,
  kits: KitRegistry,
  options: { critMode?: CritMode; battle?: Partial<BattleOptions> } = {}
): SimulationResult {
  const team = assembleTeam(input, data, kits, options.battle);
  const log = team.battle.run();
  const units = team.units();
  const model = new DamageModel(
    log,
    units,
    team.enemyMap(),
    options.critMode ?? "expected"
  );
  const report = buildDamageReport(model, unitPanels(units), units, log);
  return { team, log, model, report };
}
