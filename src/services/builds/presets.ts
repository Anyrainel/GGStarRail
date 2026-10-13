import { loadBuildReferences } from "@/services/catalog/buildReferences";
import { parseBuildWorkspaceBundle } from "./bundle";

/** HoyoData's native recommendations already contain normalized score weights. */
export async function loadInGameBuildPreset() {
  const { default: preset } = await import(
    "@/config/presets/builds/in-game.json"
  );
  return parseBuildWorkspaceBundle(JSON.stringify(preset));
}

export async function loadBuildPreset(presetId: string) {
  if (presetId !== "in-game")
    throw new Error(`Unknown build preset: ${presetId}`);
  const [preset, references] = await Promise.all([
    loadInGameBuildPreset(),
    loadBuildReferences(),
  ]);
  const slots = {
    body: "BODY",
    feet: "FOOT",
    planarSphere: "NECK",
    linkRope: "OBJECT",
  } as const;
  for (const build of preset.builds) {
    if (!references.characters.byId.has(build.characterDefinitionId))
      throw new Error("Unknown preset Character");
    const sets =
      build.category === "planar"
        ? [build.planarSetId]
        : build.cavern.mode === "four-piece"
          ? [build.cavern.setId]
          : build.cavern.setIds;
    for (const id of sets) {
      if (
        references.relicSets.byId.get(id)?.kind !==
        (build.category === "planar" ? "planar_ornament" : "cavern_relic")
      )
        throw new Error("Invalid preset Relic set");
    }
    for (const [slot, properties] of Object.entries(build.preferredMainStats)) {
      const accepted =
        references.properties.relicSlotById.get(
          slots[slot as keyof typeof slots]
        )?.valid_main_properties ?? [];
      if (properties.some((id) => !accepted.includes(id)))
        throw new Error("Invalid preset main stat");
    }
  }
  for (const [characterId, ids] of Object.entries(
    preset.characterLightConeIds
  )) {
    const character = references.characters.byId.get(characterId);
    if (
      !character ||
      ids.some(
        (id) =>
          references.lightCones.byId.get(id)?.path_id !== character.path_id
      )
    )
      throw new Error("Invalid preset Light Cone choice");
  }
  return preset;
}
