import type { CharacterKitDefinition } from "@/domain/combat/kit/character";
import type {
  LightConeKitDefinition,
  RelicSetKitDefinition,
} from "@/domain/combat/kit/equipment";
import {
  createKitRegistry,
  type KitRegistry,
} from "@/domain/combat/kit/registry";

// One file per entity keeps translations independent; discovery replaces a
// hand-maintained list that concurrent translators would conflict on.
const characterModules = import.meta.glob<CharacterKitDefinition>(
  "../../domain/combat/impl/characters/*.ts",
  { eager: true, import: "default" }
);
const lightConeModules = import.meta.glob<LightConeKitDefinition>(
  "../../domain/combat/impl/lightCones/*.ts",
  { eager: true, import: "default" }
);
const relicSetModules = import.meta.glob<RelicSetKitDefinition>(
  "../../domain/combat/impl/relicSets/*.ts",
  { eager: true, import: "default" }
);

function definitions<T extends { id: string }>(
  modules: Record<string, T>,
  type: string
): T[] {
  return Object.entries(modules).map(([path, definition]) => {
    const fileId = /\/(\d+)-[^/]+\.ts$/.exec(path)?.[1];
    if (!definition || fileId !== definition.id) {
      throw new Error(`${type} kit ${path} must default-export ID ${fileId}`);
    }
    return definition;
  });
}

export const KIT_REGISTRY: KitRegistry = createKitRegistry({
  characters: definitions(characterModules, "Character"),
  lightCones: definitions(lightConeModules, "Light Cone"),
  relicSets: definitions(relicSetModules, "Relic set"),
});
