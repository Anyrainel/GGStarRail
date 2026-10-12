import { describe, expect, it } from "vitest";
import { emptyTeam, type TeamPlan } from "@/domain/team/schemas";
import { loadPropertyTables } from "@/providers/reference/catalog";
import type { WorkspaceSources } from "@/services/combat/jobs";
import { resolveTeam } from "@/services/combat/resolve";
import {
  loadCombatPresets,
  planSets,
  previewTeam,
} from "@/services/combat/teamPreview";
import { createDemoAccount } from "../../fixtures/demoAccount";

function fixtureTeams(): TeamPlan[] {
  const plain = emptyTeam("team:plain");
  plain.members = [
    { characterId: "1001", options: {}, skill: "kit" },
    { characterId: "1003", options: {}, skill: "kit" },
    { characterId: "1102", options: {}, skill: "kit" },
    { characterId: "1309", options: {}, skill: "kit" },
  ];
  const overrides = emptyTeam("team:overrides");
  overrides.members = [
    {
      characterId: "1001",
      eidolon: 4,
      lightCone: { id: "23001", superimposition: 3 },
      relics: "ideal",
      options: {},
      skill: "kit",
    },
    null,
    {
      characterId: "1102",
      lightCone: null,
      setPlan: { cavern: ["102", "108"], planar: "309" },
      options: {},
      skill: "prefer",
    },
    {
      characterId: "1002",
      level: 70,
      setPlan: { cavern: [], planar: null },
      options: {},
      skill: "kit",
    },
  ];
  return [plain, overrides];
}

describe("team preview", () => {
  it.each([
    ["without an account", false],
    ["with an account", true],
  ])("agrees with resolveTeam %s", async (_, withAccount) => {
    const [presets, propertyTables] = await Promise.all([
      loadCombatPresets(),
      loadPropertyTables(),
    ]);
    const account = withAccount
      ? await createDemoAccount(new Date("2026-09-02T00:00:00Z"))
      : null;
    const sources: WorkspaceSources = {
      account,
      builds: [],
      characterLightConeIds: { "1309": ["23002"] },
    };
    for (const team of fixtureTeams()) {
      const preview = previewTeam(team, sources, presets);
      const resolved = resolveTeam(
        team,
        { ...sources, ...presets },
        propertyTables.propertyById
      );
      expect([...preview.keys()]).toEqual(
        resolved.members.map((member) => member.slot)
      );
      for (const member of resolved.members) {
        const shown = preview.get(member.slot);
        expect(shown, `${team.id} slot ${member.slot}`).toBeDefined();
        if (!shown) continue;
        expect(shown.characterId).toBe(member.input.characterId);
        expect(shown.owned).toBe(member.owned);
        expect(shown.level).toBe(member.input.level);
        expect(shown.eidolon).toBe(member.input.eidolon);
        expect(shown.lightCone).toEqual(
          member.input.lightCone
            ? {
                id: member.input.lightCone.id,
                superimposition: member.input.lightCone.superimposition,
              }
            : null
        );
        expect(shown.lightConeOrigin).toBe(member.lightConeOrigin);
        expect(shown.relicSource).toBe(member.relicSource);
        expect(shown.plannedSets).toEqual(planSets(member.setPlan));
        expect(shown.setPlanOrigin).toBe(member.setPlanOrigin);
      }
    }
  });

  it("shows the account's equipped Relics and origins", async () => {
    const presets = await loadCombatPresets();
    const account = await createDemoAccount(new Date("2026-09-02T00:00:00Z"));
    const [team] = fixtureTeams();
    if (!team) throw new Error("Missing fixture team");
    const preview = previewTeam(
      team,
      { account, builds: [], characterLightConeIds: { "1309": ["23002"] } },
      presets
    );
    const owned = preview.get(0);
    expect(owned?.owned).toBe(true);
    expect(owned?.relicSource).toBe("equipped");
    expect(owned?.equippedRelics.length).toBeGreaterThan(0);
    expect(owned?.eidolonOrigin).toBe("account");
    expect(owned?.lightConeOrigin).toBe("account");
    expect(preview.get(2)?.lightConeOrigin).toBe("recommended");
    expect(preview.get(2)?.eidolonOrigin).toBe("default");
    expect(preview.get(3)?.lightCone?.id).toBe("23002");
    expect(preview.get(3)?.lightConeOrigin).toBe("workspace");
  });
});
