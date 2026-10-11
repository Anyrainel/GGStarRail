import { beforeAll, describe, expect, it } from "vitest";
import type { CombatReferenceData } from "@/domain/combat/model/data";
import { generateIdealRelics } from "@/domain/combat/optimize/idealRelics";
import { TeamObjective } from "@/domain/combat/optimize/objective";
import type { RelicTables } from "@/domain/combat/optimize/relics";
import { simulateTeam } from "@/domain/combat/simulate";
import { SCENARIO_PRESETS, type TeamInput } from "@/domain/combat/team/input";
import { KIT_REGISTRY } from "@/lib/combat/kits";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";
import { buildRelicTables } from "@/lib/combat/relicTables";
import {
  loadProgression,
  loadRelicPieces,
} from "@/providers/reference/catalog";

let data: CombatReferenceData;
let tables: RelicTables;

beforeAll(async () => {
  const [reference, progression, pieces] = await Promise.all([
    loadCombatReferenceData(),
    loadProgression(),
    loadRelicPieces(),
  ]);
  data = reference;
  tables = buildRelicTables(progression, pieces.values);
});

function team(): TeamInput {
  const member = (characterId: string, lightConeId: string) => ({
    characterId,
    level: 80,
    eidolon: 0,
    traces: {},
    lightCone: { id: lightConeId, level: 80, superimposition: 1 },
    relics: { stats: {}, sets: {} },
  });
  return {
    members: [
      member("1102", "23001"),
      member("1309", "23026"),
      member("1005", "23016"),
    ],
    scenario: { ...SCENARIO_PRESETS.bossWithAdds, cycles: 3 },
  };
}

describe("optimizer objective", () => {
  it("scores a loadout exactly like a full simulation", () => {
    const input = team();
    for (const slot of [0, 1, 2]) {
      const objective = new TeamObjective(input, slot, data, KIT_REGISTRY);
      const ideal = generateIdealRelics(objective, tables, {
        plan: { cavern: { fourPiece: "108" }, planar: "306" },
        finalists: 1,
      });
      const withRelics = objective.withLoadout(ideal.loadout);
      const simulated = simulateTeam(withRelics, data, KIT_REGISTRY).report
        .total;
      // A fresh objective simulates this loadout itself; the first one
      // reuses timelines cached from other candidates with the same SPD/ERR.
      const fresh = new TeamObjective(withRelics, slot, data, KIT_REGISTRY);
      expect(fresh.evaluate(ideal.loadout)).toBeCloseTo(simulated, 6);
      expect(objective.evaluate(ideal.loadout)).toBeCloseTo(simulated, 6);
    }
  }, 60_000);
});
