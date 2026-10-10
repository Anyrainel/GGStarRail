import { describe, expect, it } from "vitest";
import { runCombatJob } from "@/lib/combat/client";
import { emptyTeam } from "@/stores/teamSchemas";

function team() {
  const plan = emptyTeam("team:test");
  plan.members[0] = { characterId: "1102", options: {}, skill: "kit" };
  plan.members[2] = { characterId: "1309", options: {}, skill: "kit" };
  return plan;
}

const sources = { account: null, characterLightConeIds: {}, builds: [] };

describe("combat jobs", () => {
  it("simulates a team with recommended gear and ideal Relics", async () => {
    const started = performance.now();
    const result = await runCombatJob({
      kind: "simulate",
      request: { team: team(), sources },
    });
    console.log(`simulate job: ${(performance.now() - started).toFixed(0)} ms`);
    expect(result.members.map((member) => member.slot)).toEqual([0, 2]);
    const seele = result.members[0];
    expect(seele?.relicSource).toBe("ideal");
    expect(seele?.lightConeOrigin).toBe("recommended");
    expect(seele?.setPlanOrigin).toBe("recommended");
    expect(seele?.ideal?.rolls).toBeDefined();
    expect(seele?.panel.critRate ?? 0).toBeGreaterThan(0.3);
    expect(result.report.total).toBeGreaterThan(0);
    // Report slots refer to the saved team's slots, not input positions.
    expect(result.report.members.map((entry) => entry.slot).sort()).toEqual([
      0, 2,
    ]);
  });

  it("returns an investment path with one step per copy", async () => {
    const result = await runCombatJob({
      kind: "investment",
      request: { team: team(), sources, slot: 0 },
    });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.every((step) => step.damage > 0)).toBe(true);
  }, 30_000);
});
