import type { ReferenceLocale } from "@/domain/provenance";
import { getLocalizedValue } from "@/providers/reference/catalog";
import type {
  LightConeDefinition,
  LightConeSuperimposition,
} from "@/providers/reference/types";

export function groupLightConeEffects(
  lightCone: LightConeDefinition,
  locale: ReferenceLocale
) {
  const groups = new Map<
    string,
    { name: string; description: string; levels: LightConeSuperimposition[] }
  >();
  for (const level of lightCone.effect.superimpositions) {
    const name = getLocalizedValue(level.name ?? lightCone.effect.name, locale);
    const description = getLocalizedValue(
      level.description ?? lightCone.effect.description,
      locale
    );
    const key = JSON.stringify([name, description]);
    const group = groups.get(key);
    if (group) group.levels.push(level);
    else groups.set(key, { name, description, levels: [level] });
  }
  return groups;
}
