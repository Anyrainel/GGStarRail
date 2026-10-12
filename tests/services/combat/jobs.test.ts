import { describe, expect, it, vi } from "vitest";
import { emptyTeam } from "@/domain/team/schemas";
import {
  CombatJobCancelled,
  cancelCombatJobs,
  createCombatJobScope,
  isCombatJobCancelled,
  runCombatJob,
} from "@/services/combat/client";
import { buildsFor, setPlanFrom } from "@/services/combat/resolve";
import { loadCombatPresets } from "@/services/combat/teamPreview";
import { createDemoAccount } from "../../fixtures/demoAccount";

function team() {
  const plan = emptyTeam("team:test");
  plan.members[0] = { characterId: "1102", options: {}, skill: "kit" };
  plan.members[2] = { characterId: "1309", options: {}, skill: "kit" };
  return plan;
}

const sources = { account: null, characterLightConeIds: {}, builds: [] };

describe("combat jobs", () => {
  it("compares owned Light Cones at their strongest available S while reserving fixed copies", async () => {
    const account = await createDemoAccount(new Date("2026-09-02T00:00:00Z"));
    const copy = account.lightCones.find(
      (entry) => entry.definitionId === "23001"
    )!;
    account.lightCones = [
      { ...copy, key: "cone4", superimposition: 4 },
      { ...copy, key: "cone2", superimposition: 2 },
    ];
    const plan = emptyTeam("owned-cones");
    plan.cycles = 1;
    plan.members[0] = { characterId: "1102", options: {}, skill: "kit" };
    const compare = () =>
      runCombatJob({
        kind: "compare",
        request: {
          team: plan,
          sources: { ...sources, account },
          slot: 0,
          kind: "lightCones",
          ownedLightConesOnly: true,
        },
      });
    const highest = await compare();
    expect(highest.map((entry) => entry.lightCone)).toEqual([
      { id: "23001", superimposition: 4 },
    ]);
    plan.members[1] = {
      characterId: "1002",
      lightCone: { id: "23001", superimposition: 4 },
      options: {},
      skill: "kit",
    };
    const reserved = await compare();
    expect(reserved.map((entry) => entry.lightCone)).toEqual([
      { id: "23001", superimposition: 2 },
    ]);
    plan.members[1]!.lightCone = { id: "23001", superimposition: 5 };
    const hypothetical = await compare();
    expect(hypothetical.map((entry) => entry.lightCone)).toEqual([
      { id: "23001", superimposition: 4 },
    ]);
    expect(hypothetical[0].ideal?.rolls).toBeDefined();
    expect(hypothetical[0].damage).toBeGreaterThan(0);
  }, 30000);

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
    expect(seele?.ultimateEnergy).toBe(true);
    expect(result.startingSkillPoints).toBe(3);
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

  it("optimizes an owned Character from the account's Relics", async () => {
    const account = await createDemoAccount(new Date("2026-09-02T00:00:00Z"));
    const plan = emptyTeam("team:owned");
    // The demo account equips Relics on March 7th and Dan Heng.
    plan.members[0] = { characterId: "1002", options: {}, skill: "kit" };
    plan.members[1] = { characterId: "1309", options: {}, skill: "kit" };
    const owned = { account, characterLightConeIds: {}, builds: [] };
    const simulated = await runCombatJob({
      kind: "simulate",
      request: { team: plan, sources: owned },
    });
    expect(simulated.members[0]?.owned).toBe(true);
    expect(simulated.members[0]?.relicSource).toBe("equipped");

    const optimized = await runCombatJob({
      kind: "optimize",
      request: { team: plan, sources: owned, slot: 0 },
    });
    expect(optimized.candidatePieces).toBeGreaterThan(0);
    expect(optimized.loadouts.length).toBeGreaterThan(0);
    const best = optimized.loadouts[0];
    expect(best?.damage ?? 0).toBeGreaterThanOrEqual(optimized.currentDamage);

    const ideal = await runCombatJob({
      kind: "ideal",
      request: {
        team: plan,
        sources: owned,
        slot: 0,
        constraints: { minSpeed: 120 },
      },
    });
    expect(ideal.speed).toBeGreaterThanOrEqual(120 - 1e-6);
    expect(Object.keys(ideal.weights).length).toBeGreaterThan(0);
    // The ideal loadout's battle-start panel.
    expect(ideal.panel.spd).toBeCloseTo(ideal.speed, 6);
    expect(ideal.panel.critRate).toBeGreaterThan(0);
    expect(ideal.panel.hp).toBeGreaterThan(0);
  }, 60_000);
});

describe("combat job options", () => {
  it("limits the investment path", async () => {
    const result = await runCombatJob({
      kind: "investment",
      request: {
        team: team(),
        sources,
        slot: 0,
        limits: { maxEidolon: 1, maxSuperimposition: 2 },
      },
    });
    expect(
      result.steps.map((step) => `${step.kind}${step.level}`).sort()
    ).toEqual(["eidolon1", "superimposition2"]);
  }, 30_000);

  it("uses chosen main stats for ideal Relics", async () => {
    const result = await runCombatJob({
      kind: "ideal",
      request: {
        team: team(),
        sources,
        slot: 0,
        mainStats: { body: ["CriticalDamageBase"], feet: ["SpeedDelta"] },
      },
    });
    expect(result.mainStats.body).toBe("CriticalDamageBase");
    expect(result.mainStats.feet).toBe("SpeedDelta");
  }, 30_000);

  it("keeps the builds' main stats in slots the filter leaves unset", async () => {
    const presets = await loadCombatPresets();
    const recommended = setPlanFrom(buildsFor(presets.presetBuilds, "1102"));
    const feet = recommended?.mainStats.feet ?? [];
    const sphere = recommended?.mainStats.planarSphere ?? [];
    expect(feet.length).toBeGreaterThan(0);
    const result = await runCombatJob({
      kind: "ideal",
      request: {
        team: team(),
        sources,
        slot: 0,
        mainStats: { body: ["CriticalDamageBase"] },
      },
    });
    expect(result.mainStats.body).toBe("CriticalDamageBase");
    expect(feet).toContain(result.mainStats.feet);
    if (sphere.length) expect(sphere).toContain(result.mainStats.planarSphere);
  }, 30_000);

  it("reports the member's own Combat Type DMG Boost on the panel", async () => {
    const result = await runCombatJob({
      kind: "ideal",
      request: {
        team: team(),
        sources,
        slot: 0,
        mainStats: { planarSphere: ["QuantumAddedRatio"] },
      },
    });
    expect(result.mainStats.planarSphere).toBe("QuantumAddedRatio");
    expect(result.panel.combatType).toBe("Quantum");
    // At least the +15 Planar Sphere's 38.8%.
    expect(result.panel.combatTypeDmg).toBeGreaterThan(0.38);
  }, 30_000);

  it("returns each compared Light Cone's ideal Relics under constraints", async () => {
    const result = await runCombatJob({
      kind: "compare",
      request: {
        team: team(),
        sources,
        slot: 2,
        kind: "lightCones",
        constraints: { minSpeed: 110 },
      },
    });
    expect(result.length).toBeGreaterThan(1);
    for (const entry of result) {
      expect(entry.lightCone).toBeDefined();
      expect(Object.keys(entry.ideal?.mainStats ?? {})).toHaveLength(6);
      expect(Object.keys(entry.ideal?.rolls ?? {}).length).toBeGreaterThan(0);
    }
  }, 120_000);

  it("marks Ultimates paid with a kit resource instead of Energy", async () => {
    const plan = emptyTeam("team:resource");
    plan.members[0] = { characterId: "1308", options: {}, skill: "kit" };
    plan.members[1] = { characterId: "1309", options: {}, skill: "kit" };
    const result = await runCombatJob({
      kind: "simulate",
      request: { team: plan, sources },
    });
    expect(result.members.map((member) => member.ultimateEnergy)).toEqual([
      false,
      true,
    ]);
  }, 30_000);

  it("simulates with account Relics in place of a member's own", async () => {
    const account = await createDemoAccount(new Date("2026-09-02T00:00:00Z"));
    const plan = emptyTeam("team:overrides");
    plan.members[0] = { characterId: "1002", options: {}, skill: "kit" };
    plan.members[1] = { characterId: "1309", options: {}, skill: "kit" };
    const owned = { account, characterLightConeIds: {}, builds: [] };
    const optimized = await runCombatJob({
      kind: "optimize",
      request: { team: plan, sources: owned, slot: 0 },
    });
    const best = optimized.loadouts[0];
    if (!best) throw new Error("No optimized loadout");
    const [current, combined] = await Promise.all([
      runCombatJob({
        kind: "simulate",
        request: { team: plan, sources: owned },
      }),
      runCombatJob({
        kind: "simulate",
        request: {
          team: plan,
          sources: owned,
          relicOverrides: { 0: best.relicKeys },
        },
      }),
    ]);
    expect(combined.report.total).toBeGreaterThan(0);
    expect(combined.members[0]?.panel).not.toEqual(current.members[0]?.panel);

    // The next member's search wears the first member's loadout and cannot
    // take its Relics.
    const next = await runCombatJob({
      kind: "optimize",
      request: {
        team: plan,
        sources: owned,
        slot: 1,
        relicOverrides: { 0: best.relicKeys },
      },
    });
    const claimed = new Set(Object.values(best.relicKeys).filter(Boolean));
    expect(next.loadouts.length).toBeGreaterThan(0);
    for (const loadout of next.loadouts)
      for (const key of Object.values(loadout.relicKeys))
        expect(claimed.has(key)).toBe(false);
  }, 120_000);
});

describe("combat worker lanes", () => {
  class FakeWorker {
    static created: FakeWorker[] = [];
    readonly posted: unknown[] = [];
    terminated = false;
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor() {
      FakeWorker.created.push(this);
    }
    postMessage(message: unknown) {
      this.posted.push(message);
    }
    terminate() {
      this.terminated = true;
    }
  }

  it("stops only the owning analysis scope and releases a finished scope's worker", async () => {
    FakeWorker.created = [];
    vi.stubGlobal("Worker", FakeWorker);
    const first = createCombatJobScope();
    const second = createCombatJobScope();
    expect(FakeWorker.created).toHaveLength(0);
    try {
      const stopped = runCombatJob(
        { kind: "ideal", request: { team: team(), sources, slot: 0 } },
        "analysis",
        first
      );
      const continuing = runCombatJob(
        { kind: "ideal", request: { team: team(), sources, slot: 0 } },
        "analysis",
        second
      );
      const [firstWorker, secondWorker] = FakeWorker.created;
      expect(FakeWorker.created).toHaveLength(2);
      cancelCombatJobs("analysis", first);
      await expect(stopped).rejects.toBeInstanceOf(CombatJobCancelled);
      expect(firstWorker.terminated).toBe(true);
      expect(secondWorker.terminated).toBe(false);
      const message = secondWorker.posted[0] as { id: number };
      secondWorker.onmessage?.(
        new MessageEvent("message", {
          data: { id: message.id, result: "completed" },
        })
      );
      await expect(continuing).resolves.toBe("completed");
      cancelCombatJobs("analysis", second);
      expect(secondWorker.terminated).toBe(true);
      const next = runCombatJob(
        { kind: "ideal", request: { team: team(), sources, slot: 0 } },
        "analysis",
        second
      );
      expect(FakeWorker.created).toHaveLength(3);
      const nextWorker = FakeWorker.created[2];
      const nextMessage = nextWorker.posted[0] as { id: number };
      // A late reply from the released worker cannot finish the new owner's job.
      secondWorker.onmessage?.(
        new MessageEvent("message", {
          data: { id: message.id, result: "stale" },
        })
      );
      nextWorker.onmessage?.(
        new MessageEvent("message", {
          data: { id: nextMessage.id, result: "fresh" },
        })
      );
      await expect(next).resolves.toBe("fresh");
    } finally {
      cancelCombatJobs("analysis", first);
      cancelCombatJobs("analysis", second);
      vi.unstubAllGlobals();
    }
  });

  it("cancels analysis jobs without touching the interactive lane", async () => {
    FakeWorker.created = [];
    vi.stubGlobal("Worker", FakeWorker);
    try {
      const analysis = runCombatJob({
        kind: "investment",
        request: { team: team(), sources, slot: 0 },
      });
      const interactive = runCombatJob({
        kind: "simulate",
        request: { team: team(), sources },
      });
      expect(FakeWorker.created).toHaveLength(2);
      const [analysisWorker, interactiveWorker] = FakeWorker.created;
      cancelCombatJobs("analysis");
      await expect(analysis).rejects.toBeInstanceOf(CombatJobCancelled);
      expect(analysisWorker?.terminated).toBe(true);
      expect(interactiveWorker?.terminated).toBe(false);

      const reply = interactiveWorker?.posted[0] as { id: number };
      interactiveWorker?.onmessage?.(
        new MessageEvent("message", { data: { id: reply.id, result: "ok" } })
      );
      await expect(interactive).resolves.toBe("ok");

      const next = runCombatJob({
        kind: "ideal",
        request: { team: team(), sources, slot: 0 },
      });
      expect(FakeWorker.created).toHaveLength(3);
      cancelCombatJobs();
      await expect(next).rejects.toSatisfy(isCombatJobCancelled);
    } finally {
      cancelCombatJobs("analysis");
      cancelCombatJobs("interactive");
      vi.unstubAllGlobals();
    }
  });
});
