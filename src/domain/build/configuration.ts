import type { Relic, RelicSlot } from "@/domain/account/schemas";
import {
  type BuildConfiguration,
  BuildConfigurationSchema,
  type ScoreProfile,
  ScoreProfileSchema,
} from "./schemas";

export interface CharacterBuildDefinition {
  id: string;
  combat_type_id: string;
}

export interface BuildProgressionTables {
  relic_scoring: {
    main_affix_base_values: readonly {
      property_id: string;
      score_type: string;
      base_value: number;
    }[];
    sub_affix_base_values: readonly {
      property_id: string;
      score_type: string;
      base_value: number;
    }[];
    main_affix_character_weights: readonly {
      character_id: string;
      weights: Readonly<Record<string, number>>;
    }[];
    sub_affix_character_weights: readonly {
      character_id: string;
      weights: Readonly<Record<string, number>>;
    }[];
  };
}

export interface BuildPropertyCatalog {
  relicSlotById: ReadonlyMap<
    string,
    { id: string; valid_main_properties: readonly string[] }
  >;
}

export interface BuildRelicSetDefinition {
  id: string;
  kind: "cavern_relic" | "planar_ornament";
}

export const DEFAULT_GRADE_THRESHOLDS = {
  s: 50,
  a: 40,
  b: 30,
  c: 20,
} as const;

const DOMAIN_TO_CATALOG_SLOT = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, string>;

const ELEMENT_MAIN_STAT = {
  Fire: "FireAddedRatio",
  Ice: "IceAddedRatio",
  Imaginary: "ImaginaryAddedRatio",
  Physical: "PhysicalAddedRatio",
  Quantum: "QuantumAddedRatio",
  Thunder: "ThunderAddedRatio",
  Wind: "WindAddedRatio",
} as const satisfies Record<string, string>;

function newId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

function scoreBaseByProperty(
  progression: BuildProgressionTables,
  kind: "main" | "sub"
): ReadonlyMap<string, { scoreType: string; baseValue: number }> {
  const rows =
    kind === "main"
      ? progression.relic_scoring.main_affix_base_values
      : progression.relic_scoring.sub_affix_base_values;
  return new Map(
    rows.map((row) => [
      row.property_id,
      { scoreType: row.score_type, baseValue: row.base_value },
    ])
  );
}

export function createCharacterScoreProfile(
  character: CharacterBuildDefinition,
  progression: BuildProgressionTables,
  name: string,
  id = newId("score")
): ScoreProfile {
  const weightsByType =
    progression.relic_scoring.sub_affix_character_weights.find(
      (entry) => entry.character_id === character.id
    )?.weights ?? {};
  const scoreBases = scoreBaseByProperty(progression, "sub");
  const maximumBaseByType = new Map<string, number>();
  for (const { scoreType, baseValue } of scoreBases.values()) {
    maximumBaseByType.set(
      scoreType,
      Math.max(maximumBaseByType.get(scoreType) ?? 0, baseValue)
    );
  }
  const statWeights = Object.fromEntries(
    [...scoreBases].map(([propertyId, { scoreType, baseValue }]) => {
      const maximumBase = maximumBaseByType.get(scoreType) ?? baseValue;
      const unitFactor = maximumBase > 0 ? baseValue / maximumBase : 0;
      return [propertyId, (weightsByType[scoreType] ?? 0) * unitFactor];
    })
  );
  return ScoreProfileSchema.parse({
    id,
    name,
    statWeights,
    includeMainStat: false,
    mainStatWeight: 0.5,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  });
}

function preferredMainStats(
  character: CharacterBuildDefinition,
  progression: BuildProgressionTables,
  properties: BuildPropertyCatalog
): BuildConfiguration["preferredMainStats"] {
  const weightsByType =
    progression.relic_scoring.main_affix_character_weights.find(
      (entry) => entry.character_id === character.id
    )?.weights ?? {};
  const scoreBases = scoreBaseByProperty(progression, "main");
  const elementProperty =
    ELEMENT_MAIN_STAT[
      character.combat_type_id as keyof typeof ELEMENT_MAIN_STAT
    ];

  const choose = (slot: "body" | "feet" | "planarSphere" | "linkRope") => {
    const definition = properties.relicSlotById.get(
      DOMAIN_TO_CATALOG_SLOT[slot]
    );
    const candidates = definition?.valid_main_properties ?? [];
    const weighted = candidates.map((propertyId) => {
      const scoreType = scoreBases.get(propertyId)?.scoreType;
      const elementMismatch =
        scoreType === "DamageAddedRatio" && propertyId !== elementProperty;
      return {
        propertyId,
        weight: elementMismatch ? 0 : (weightsByType[scoreType ?? ""] ?? 0),
      };
    });
    const maximum = Math.max(...weighted.map(({ weight }) => weight), 0);
    const selected = weighted
      .filter(({ weight }) => weight === maximum && weight > 0)
      .map(({ propertyId }) => propertyId);
    return selected.length > 0 ? selected : candidates.slice(0, 1);
  };

  return {
    body: choose("body"),
    feet: choose("feet"),
    planarSphere: choose("planarSphere"),
    linkRope: choose("linkRope"),
  };
}

function equippedSetCounts(
  characterKey: string | undefined,
  relics: readonly Relic[],
  kind: "cavern" | "planar"
): Array<[string, number]> {
  if (!characterKey) return [];
  const counts = new Map<string, number>();
  for (const relic of relics) {
    const isPlanar = relic.slot === "planarSphere" || relic.slot === "linkRope";
    if (
      relic.equippedCharacterKey !== characterKey ||
      (kind === "planar") !== isPlanar
    ) {
      continue;
    }
    counts.set(relic.setId, (counts.get(relic.setId) ?? 0) + 1);
  }
  return [...counts].sort(
    ([leftId, leftCount], [rightId, rightCount]) =>
      rightCount - leftCount || leftId.localeCompare(rightId)
  );
}

export function createCharacterBuild(
  character: CharacterBuildDefinition,
  characterKey: string | undefined,
  relics: readonly Relic[],
  relicSets: readonly BuildRelicSetDefinition[],
  properties: BuildPropertyCatalog,
  progression: BuildProgressionTables,
  scoreProfileId: string,
  name: string,
  id = newId("build")
): BuildConfiguration {
  const cavernSets = relicSets.filter((set) => set.kind === "cavern_relic");
  const planarSets = relicSets.filter((set) => set.kind === "planar_ornament");
  const equippedCavern = equippedSetCounts(characterKey, relics, "cavern");
  const equippedPlanar = equippedSetCounts(characterKey, relics, "planar");
  const cavernIds = equippedCavern.map(([setId]) => setId);
  const defaultCavernId = cavernIds[0] ?? cavernSets[0]?.id;
  const defaultPlanarId = equippedPlanar[0]?.[0] ?? planarSets[0]?.id;
  if (!defaultCavernId || !defaultPlanarId) {
    throw new Error("The Relic set catalog is incomplete");
  }
  const hasTwoPlusTwo =
    equippedCavern.length >= 2 &&
    (equippedCavern[0]?.[1] ?? 0) >= 2 &&
    (equippedCavern[1]?.[1] ?? 0) >= 2;

  return BuildConfigurationSchema.parse({
    id,
    name,
    characterDefinitionId: character.id,
    scoreProfileId,
    cavern: hasTwoPlusTwo
      ? {
          mode: "two-plus-two",
          setIds: [equippedCavern[0]?.[0], equippedCavern[1]?.[0]],
        }
      : { mode: "four-piece", setId: defaultCavernId },
    planarSetId: defaultPlanarId,
    preferredMainStats: preferredMainStats(character, progression, properties),
  });
}
