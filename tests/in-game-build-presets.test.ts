import { describe, expect, it } from "vitest";
import { parseBuildWorkspaceBundle } from "@/lib/buildBundle";
import { buildDisplayName } from "@/lib/buildPresentation";
import { loadBuildReferences } from "@/lib/buildReferences";
import inGamePreset from "@/presets/builds/in-game.json";
import type { RelicSlotId } from "@/providers/reference/types";

const slots = {
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<string, RelicSlotId>;

describe("generated in-game build presets", () => {
  it("imports one language-neutral preset with localized metadata", () => {
    const preset = parseBuildWorkspaceBundle(JSON.stringify(inGamePreset));
    expect(preset.metadata).toEqual({
      name: { en: "In-Game Recommended Builds", "zh-CN": "游戏内置推荐配装" },
      author: "In-Game",
    });
    expect(preset.builds.length).toBeGreaterThan(0);
    expect(
      new Set(preset.builds.map((build) => build.scoreProfileId)).size
    ).toBe(preset.builds.length);
    expect(preset.builds.every((build) => build.name === undefined)).toBe(true);
    expect(
      preset.scoreProfiles.every((profile) => profile.name === undefined)
    ).toBe(true);
  });

  it("references available Characters, sets, Light Cones, and legal slot main stats", async () => {
    const references = await loadBuildReferences();
    const preset = parseBuildWorkspaceBundle(JSON.stringify(inGamePreset));
    for (const build of preset.builds) {
      expect(references.characters.byId.has(build.characterDefinitionId)).toBe(
        true
      );
      const setIds =
        build.category === "planar"
          ? [build.planarSetId]
          : build.cavern.mode === "four-piece"
            ? [build.cavern.setId]
            : build.cavern.setIds;
      for (const setId of setIds)
        expect(references.relicSets.byId.get(setId)?.kind).toBe(
          build.category === "planar" ? "planar_ornament" : "cavern_relic"
        );
      for (const [slot, stats] of Object.entries(build.preferredMainStats)) {
        const accepted = references.properties.relicSlotById.get(
          slots[slot as keyof typeof slots]
        )!.valid_main_properties;
        for (const stat of stats) expect(accepted).toContain(stat);
      }
    }
    for (const [characterId, coneIds] of Object.entries(
      preset.characterLightConeIds
    )) {
      for (const coneId of coneIds)
        expect(references.lightCones.byId.get(coneId)?.path_id).toBe(
          references.characters.byId.get(characterId)!.path_id
        );
    }
  });
  it("derives card names in the current locale and preserves user names", async () => {
    const references = await loadBuildReferences();
    const preset = parseBuildWorkspaceBundle(JSON.stringify(inGamePreset));
    const build = preset.builds[0]!;
    expect(buildDisplayName(build, references, "en")).not.toBe(
      buildDisplayName(build, references, "zh-CN")
    );
    const customized = { ...build, name: "My build" };
    expect(buildDisplayName(customized, references, "en")).toBe("My build");
    expect(buildDisplayName(customized, references, "zh-CN")).toBe("My build");
  });
});
