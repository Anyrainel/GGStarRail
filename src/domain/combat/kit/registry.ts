import type { CharacterKitDefinition } from "./character";
import type {
  LightConeKitDefinition,
  RelicSetKitDefinition,
} from "./equipment";

/** Translated entity behaviour, keyed by catalog ID. */
export interface KitRegistry {
  character(id: string): CharacterKitDefinition | undefined;
  lightCone(id: string): LightConeKitDefinition | undefined;
  relicSet(id: string): RelicSetKitDefinition | undefined;
  readonly characterIds: ReadonlySet<string>;
  readonly lightConeIds: ReadonlySet<string>;
  readonly relicSetIds: ReadonlySet<string>;
}

function index<T extends { id: string }>(
  kind: string,
  definitions: readonly T[]
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const definition of definitions) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate ${kind} kit ${definition.id}`);
    }
    byId.set(definition.id, definition);
  }
  return byId;
}

export function createKitRegistry(definitions: {
  characters: readonly CharacterKitDefinition[];
  lightCones: readonly LightConeKitDefinition[];
  relicSets: readonly RelicSetKitDefinition[];
}): KitRegistry {
  const characters = index("Character", definitions.characters);
  const lightCones = index("Light Cone", definitions.lightCones);
  const relicSets = index("Relic set", definitions.relicSets);
  return {
    character: (id) => characters.get(id),
    lightCone: (id) => lightCones.get(id),
    relicSet: (id) => relicSets.get(id),
    characterIds: new Set(characters.keys()),
    lightConeIds: new Set(lightCones.keys()),
    relicSetIds: new Set(relicSets.keys()),
  };
}
