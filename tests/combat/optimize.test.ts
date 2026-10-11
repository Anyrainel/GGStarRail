import { beforeAll, describe, expect, it } from "vitest";
import seele from "@/domain/combat/impl/characters/1102-seele";
import robin from "@/domain/combat/impl/characters/1309-robin";
import genius from "@/domain/combat/impl/relicSets/108-genius-of-brilliant-stars";
import rutilant from "@/domain/combat/impl/relicSets/309-rutilant-arena";
import { createKitRegistry } from "@/domain/combat/kit/registry";
import type { CombatReferenceData } from "@/domain/combat/model/data";
import { deriveStatWeights } from "@/domain/combat/optimize/analysis";
import { generateIdealRelics } from "@/domain/combat/optimize/idealRelics";
import { TeamObjective } from "@/domain/combat/optimize/objective";
import { searchRelics } from "@/domain/combat/optimize/relicSearch";
import type { RelicPiece, RelicTables } from "@/domain/combat/optimize/relics";
import { SCENARIO_PRESETS, type TeamInput } from "@/domain/combat/team/input";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";
import { buildRelicTables } from "@/lib/combat/relicTables";
import {
  loadProgression,
  loadRelicPieces,
} from "@/providers/reference/catalog";

const kits = createKitRegistry({
  characters: [seele, robin],
  lightCones: [],
  relicSets: [genius, rutilant],
});

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
  const member = (characterId: string) => ({
    characterId,
    level: 80,
    eidolon: 0,
    traces: {},
    lightCone: null,
    relics: { stats: {}, sets: {} },
  });
  return {
    members: [member("1102"), member("1309")],
    scenario: { ...SCENARIO_PRESETS.singleBoss, cycles: 3 },
  };
}

const plan = { cavern: { fourPiece: "108" }, planar: "309" } as const;

describe("relic optimization", () => {
  it("generates feasible ideal Relics that favour crit for Seele", () => {
    const objective = new TeamObjective(team(), 0, data, kits);
    const empty = objective.evaluate({ stats: {}, sets: {} });
    const started = performance.now();
    const ideal = generateIdealRelics(objective, tables, { plan });
    const elapsed = performance.now() - started;
    const total = Object.values(ideal.rolls).reduce(
      (sum, count) => sum + count,
      0
    );
    expect(total).toBeLessThanOrEqual(48);
    expect(ideal.damage).toBeGreaterThan(empty * 2);
    expect(
      (ideal.rolls.CriticalChanceBase ?? 0) +
        (ideal.rolls.CriticalDamageBase ?? 0)
    ).toBeGreaterThan(10);
    expect(["CriticalChanceBase", "CriticalDamageBase"]).toContain(
      ideal.mainStats.body
    );
    console.log(
      `ideal: ${elapsed.toFixed(0)} ms, ${objective.evaluations} evaluations, ${objective.simulations} simulations`,
      ideal.mainStats,
      ideal.rolls
    );
  });

  it("meets a SPD minimum with SPD boots or rolls", () => {
    const objective = new TeamObjective(team(), 0, data, kits);
    const ideal = generateIdealRelics(objective, tables, {
      plan,
      constraints: { minSpeed: 160 },
    });
    expect(ideal.feasible).toBe(true);
    expect(objective.memberPanel(ideal.loadout).speed).toBeGreaterThanOrEqual(
      160
    );
  });

  it("finds the best inventory loadout and derives stat weights", () => {
    const objective = new TeamObjective(team(), 0, data, kits);
    const ideal = generateIdealRelics(objective, tables, { plan });
    // Inventory: the ideal pieces, weaker copies, and an off-set alternative.
    const pieces: RelicPiece[] = [];
    for (const piece of Object.values(ideal.pieces)) {
      if (!piece) continue;
      pieces.push({ ...piece, key: `best:${piece.slot}` });
      pieces.push({
        ...piece,
        key: `weak:${piece.slot}`,
        stats: Object.fromEntries(
          Object.entries(piece.stats).map(([property, value]) => [
            property,
            property === piece.mainStat ? value : value * 0.5,
          ])
        ),
      });
      pieces.push({
        ...piece,
        key: `offset:${piece.slot}`,
        setId:
          piece.slot === "planarSphere" || piece.slot === "linkRope"
            ? "301"
            : "101",
      });
    }
    const started = performance.now();
    const result = searchRelics(objective, tables, { pieces });
    const elapsed = performance.now() - started;
    const best = result.loadouts[0];
    expect(best).toBeDefined();
    expect(
      Object.values(best?.pieces ?? {}).every((piece) =>
        piece?.key.startsWith("best:")
      )
    ).toBe(true);
    console.log(
      `search: ${elapsed.toFixed(0)} ms, ${result.evaluations} evaluations, ${result.simulations} simulations, ${result.plansConsidered} plans`
    );

    const weights = deriveStatWeights(objective, tables, ideal.loadout);
    expect(
      Math.max(weights.CriticalDamageBase ?? 0, weights.CriticalChanceBase ?? 0)
    ).toBe(1);
    expect(weights.HPDelta ?? 0).toBeLessThan(0.1);
  });
});
