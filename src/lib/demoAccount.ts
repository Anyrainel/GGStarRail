import {
  type AccountSnapshot,
  AccountSnapshotSchema,
  type RelicSlot,
} from "@/domain/account/schemas";
import {
  HSR_REFERENCE_MANIFEST,
  loadCharacters,
  loadLightCones,
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
} from "@/providers/gilore/catalog";
import type {
  MainAffixDefinition,
  PropertyDefinition,
  RelicPieceDefinition,
  SubAffixDefinition,
} from "@/providers/gilore/types";

const DEMO_CHARACTER_IDS = ["1001", "1002", "1003", "1004", "1005", "1006"];

const DEMO_LIGHT_CONES = [
  { definitionId: "23005", characterId: "1001" },
  { definitionId: "23001", characterId: "1002" },
  { definitionId: "23000", characterId: "1003" },
  { definitionId: "23004", characterId: "1004" },
  { definitionId: "23006", characterId: "1005" },
  { definitionId: "23007", characterId: "1006" },
] as const;

const DEMO_RELICS = [
  { definitionId: "61011", characterId: "1001", mainStatId: "HPDelta" },
  { definitionId: "61012", characterId: "1001", mainStatId: "AttackDelta" },
  {
    definitionId: "61013",
    characterId: "1001",
    mainStatId: "CriticalChanceBase",
  },
  { definitionId: "61014", characterId: "1001", mainStatId: "SpeedDelta" },
  {
    definitionId: "63015",
    characterId: "1001",
    mainStatId: "IceAddedRatio",
  },
  { definitionId: "63016", characterId: "1001", mainStatId: "SPRatioBase" },
  { definitionId: "61021", characterId: "1002", mainStatId: "HPDelta" },
  { definitionId: "61022", characterId: "1002", mainStatId: "AttackDelta" },
  {
    definitionId: "61023",
    characterId: "1002",
    mainStatId: "CriticalDamageBase",
  },
  {
    definitionId: "61024",
    characterId: "1002",
    mainStatId: "AttackAddedRatio",
  },
  {
    definitionId: "63025",
    characterId: "1002",
    mainStatId: "WindAddedRatio",
  },
  {
    definitionId: "63026",
    characterId: "1002",
    mainStatId: "BreakDamageAddedRatioBase",
  },
] as const;

const CATALOG_SLOT_TO_DOMAIN = {
  HEAD: "head",
  HAND: "hands",
  BODY: "body",
  FOOT: "feet",
  NECK: "planarSphere",
  OBJECT: "linkRope",
} as const satisfies Record<RelicPieceDefinition["slot"], RelicSlot>;

const SUBSTAT_PRIORITY = [
  "CriticalChanceBase",
  "CriticalDamageBase",
  "SpeedDelta",
  "AttackAddedRatio",
  "BreakDamageAddedRatioBase",
  "StatusResistanceBase",
  "HPAddedRatio",
  "DefenceAddedRatio",
] as const;

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Demo account catalog entry is missing: ${label}`);
  }
  return value;
}

function isRatioProperty(property: PropertyDefinition): boolean {
  return (
    property.value_kind === "ratio" ||
    /(Ratio|Chance|DamageBase|Resistance|Probability)/.test(property.id)
  );
}

function accountStatValue(
  property: PropertyDefinition,
  sourceValue: number
): number {
  const normalized = isRatioProperty(property)
    ? sourceValue * 100
    : sourceValue;
  return Number(normalized.toFixed(3));
}

function mainStatValue(
  piece: RelicPieceDefinition,
  property: PropertyDefinition,
  mainAffixes: readonly MainAffixDefinition[]
): number {
  const affix = required(
    mainAffixes.find(
      (candidate) =>
        candidate.group_id === piece.main_affix_group &&
        candidate.property_id === property.id
    ),
    `main affix ${piece.id}/${property.id}`
  );
  return accountStatValue(
    property,
    required(affix.level_values.at(-1), `main affix level ${piece.id}`)
  );
}

function demoSubstats(
  piece: RelicPieceDefinition,
  mainStatId: string,
  propertyById: ReadonlyMap<string, PropertyDefinition>,
  subAffixes: readonly SubAffixDefinition[],
  seed: number
) {
  const affixByProperty = new Map(
    subAffixes
      .filter((affix) => affix.group_id === piece.sub_affix_group)
      .map((affix) => [affix.property_id, affix])
  );
  const orderedIds = [
    ...SUBSTAT_PRIORITY.slice(seed % SUBSTAT_PRIORITY.length),
    ...SUBSTAT_PRIORITY.slice(0, seed % SUBSTAT_PRIORITY.length),
  ];
  return orderedIds
    .filter((propertyId) => propertyId !== mainStatId)
    .flatMap((propertyId, index) => {
      const property = propertyById.get(propertyId);
      const affix = affixByProperty.get(propertyId);
      if (!property || !affix) return [];
      const roll = required(
        affix.roll_values[(seed + index) % affix.roll_values.length],
        `substat roll ${piece.id}/${propertyId}`
      );
      return [
        {
          statId: propertyId,
          value: accountStatValue(property, roll),
        },
      ];
    })
    .slice(0, 4);
}

export async function createDemoAccount(
  now = new Date()
): Promise<AccountSnapshot> {
  const [
    characterCatalog,
    lightConeCatalog,
    relicPieceCatalog,
    properties,
    progression,
  ] = await Promise.all([
    loadCharacters(),
    loadLightCones(),
    loadRelicPieces(),
    loadPropertyTables(),
    loadProgression(),
  ]);

  const characterKeys = new Map(
    DEMO_CHARACTER_IDS.map((definitionId) => [
      definitionId,
      `demo-character:${definitionId}`,
    ])
  );
  const lightConeKeys = new Map<string, string>(
    DEMO_LIGHT_CONES.map(({ definitionId, characterId }) => [
      characterId,
      `demo-light-cone:${definitionId}`,
    ])
  );
  const relicKeysByCharacter = new Map<string, string[]>();

  const relics = DEMO_RELICS.map((loadout, index) => {
    const piece = required(
      relicPieceCatalog.byId.get(loadout.definitionId),
      `Relic piece ${loadout.definitionId}`
    );
    const property = required(
      properties.propertyById.get(loadout.mainStatId),
      `property ${loadout.mainStatId}`
    );
    const key = `demo-relic:${piece.id}`;
    const equippedCharacterKey = required(
      characterKeys.get(loadout.characterId),
      `Character ${loadout.characterId}`
    );
    const equippedRelics = relicKeysByCharacter.get(loadout.characterId) ?? [];
    equippedRelics.push(key);
    relicKeysByCharacter.set(loadout.characterId, equippedRelics);
    return {
      key,
      definitionId: piece.id,
      setId: piece.set_id,
      slot: CATALOG_SLOT_TO_DOMAIN[piece.slot],
      rarity: piece.rarity,
      level: piece.max_level,
      mainStat: {
        statId: property.id,
        value: mainStatValue(piece, property, progression.relic_main_affixes),
      },
      substats: demoSubstats(
        piece,
        property.id,
        properties.propertyById,
        progression.relic_sub_affixes,
        index
      ),
      locked: index % 3 === 0,
      equippedCharacterKey,
    };
  });

  const lightCones = DEMO_LIGHT_CONES.map((loadout, index) => {
    const definition = required(
      lightConeCatalog.byId.get(loadout.definitionId),
      `Light Cone ${loadout.definitionId}`
    );
    const equippedCharacterKey = required(
      characterKeys.get(loadout.characterId),
      `Character ${loadout.characterId}`
    );
    const finalPromotion = required(
      definition.promotions.at(-1),
      `Light Cone promotion ${definition.id}`
    );
    return {
      key: `demo-light-cone:${definition.id}`,
      definitionId: definition.id,
      pathId: definition.path_id,
      level: finalPromotion.max_level,
      ascension: definition.max_promotion,
      superimposition: Math.min(index + 1, definition.max_superimposition),
      locked: index % 2 === 0,
      equippedCharacterKey,
    };
  });

  const characters = DEMO_CHARACTER_IDS.map((definitionId, index) => {
    const definition = required(
      characterCatalog.byId.get(definitionId),
      `Character ${definitionId}`
    );
    const finalPromotion = required(
      definition.promotions.at(-1),
      `Character promotion ${definition.id}`
    );
    return {
      key: required(characterKeys.get(definition.id), definition.id),
      definitionId: definition.id,
      pathId: definition.path_id,
      combatTypeId: definition.combat_type_id,
      level: finalPromotion.max_level,
      ascension: definition.max_promotion,
      eidolon: Math.min(index, definition.max_rank),
      traces: {},
      lightConeKey: required(lightConeKeys.get(definition.id), definition.id),
      relicKeys: relicKeysByCharacter.get(definition.id) ?? [],
    };
  });

  return AccountSnapshotSchema.parse({
    schemaVersion: 1,
    profileId: "demo-account:v1",
    trailblazeLevel: 70,
    characters,
    lightCones,
    relics,
    source: {
      provider: "demo-account",
      formatVersion: 1,
      sourceVersion: HSR_REFERENCE_MANIFEST.schema_version,
      sourceRevision: HSR_REFERENCE_MANIFEST.source.revision,
      importedAt: now.toISOString(),
      warnings: [],
    },
  });
}
