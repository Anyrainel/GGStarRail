import type { RelicSlot } from "@/domain/account/schemas";
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
    // Without character scoring data, leave every valid main stat accepted.
    // Catalog ordering is not a recommendation for this Character.
    return selected.length > 0 ? selected : [...candidates];
  };

  return {
    body: choose("body"),
    feet: choose("feet"),
    planarSphere: choose("planarSphere"),
    linkRope: choose("linkRope"),
  };
}

export function createCharacterBuild(
  character: CharacterBuildDefinition,
  setPlan: Pick<BuildConfiguration, "cavern" | "planarSetId">,
  properties: BuildPropertyCatalog,
  progression: BuildProgressionTables,
  scoreProfileId: string,
  name: string,
  id = newId("build")
): BuildConfiguration {
  return BuildConfigurationSchema.parse({
    id,
    name,
    characterDefinitionId: character.id,
    scoreProfileId,
    cavern: setPlan.cavern,
    planarSetId: setPlan.planarSetId,
    preferredMainStats: preferredMainStats(character, progression, properties),
  });
}
