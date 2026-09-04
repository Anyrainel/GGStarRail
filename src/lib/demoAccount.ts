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
  PropertyDefinition,
  RelicPieceDefinition,
  SubAffixDefinition,
} from "@/providers/gilore/types";
import { generatedRelicMainStatDisplayValues } from "@/providers/relicMainStat";

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

function demoSubstats(
  piece: RelicPieceDefinition,
  mainStatId: string,
  propertyById: ReadonlyMap<string, PropertyDefinition>,
  subAffixes: readonly SubAffixDefinition[],
  level: number,
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
  const available = orderedIds
    .filter((propertyId) => propertyId !== mainStatId)
    .flatMap((propertyId) => {
      const property = propertyById.get(propertyId);
      const affix = affixByProperty.get(propertyId);
      if (!property || !affix) return [];
      return [{ property, affix }];
    })
    .slice(0, 4);
  const minimumInitialLines = Math.max(1, Math.min(4, piece.rarity - 2));
  const maximumInitialLines = Math.max(1, Math.min(4, piece.rarity - 1));
  const initialLineCount =
    seed % 2 === 0 ? minimumInitialLines : maximumInitialLines;
  const selected = available
    .slice(0, initialLineCount)
    .map((entry) => ({ ...entry, rollCount: 1 }));
  const upgradeRolls = Math.floor(Math.min(level, piece.max_level) / 3);
  for (let upgrade = 0; upgrade < upgradeRolls; upgrade += 1) {
    if (selected.length < 4) {
      const unlocked = available[selected.length];
      if (unlocked) selected.push({ ...unlocked, rollCount: 1 });
      continue;
    }
    const target = selected[(seed + upgrade) % selected.length];
    if (target) target.rollCount += 1;
  }
  return selected.map(({ property, affix, rollCount }) => {
    const roll = required(
      affix.roll_values.at(-1),
      `substat roll ${piece.id}/${property.id}`
    );
    return {
      statId: property.id,
      value: accountStatValue(property, roll * rollCount),
    };
  });
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
        value: generatedRelicMainStatDisplayValues(
          piece,
          property.id,
          piece.max_level,
          properties.properties,
          progression.relic_main_affixes
        ).exact,
      },
      substats: demoSubstats(
        piece,
        property.id,
        properties.propertyById,
        progression.relic_sub_affixes,
        piece.max_level,
        index
      ),
      locked: index % 3 === 0,
      discarded: false,
      equippedCharacterKey,
    };
  });
  const spareRelics = relics.slice(0, 8).map((relic, index) => {
    const level = index % 3 === 0 ? 0 : index % 3 === 1 ? 6 : 15;
    const piece = required(
      relicPieceCatalog.byId.get(relic.definitionId),
      `Relic piece ${relic.definitionId}`
    );
    return {
      ...relic,
      key: `demo-relic:spare:${index + 1}`,
      level,
      mainStat: {
        ...relic.mainStat,
        value: generatedRelicMainStatDisplayValues(
          piece,
          relic.mainStat.statId,
          level,
          properties.properties,
          progression.relic_main_affixes
        ).exact,
      },
      substats: demoSubstats(
        piece,
        relic.mainStat.statId,
        properties.propertyById,
        progression.relic_sub_affixes,
        level,
        index
      ),
      locked: false,
      discarded: index === 7,
      equippedCharacterKey: undefined,
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
    schemaVersion: 3,
    profileId: "demo-account:v3",
    trailblazeLevel: 70,
    characters,
    lightCones,
    relics: [...relics, ...spareRelics],
    source: {
      provider: "demo-account",
      formatVersion: 1,
      sourceVersion: HSR_REFERENCE_MANIFEST.schema_version,
      sourceRevision: HSR_REFERENCE_MANIFEST.source.revision,
      importedAt: now.toISOString(),
      coverage: {
        characters: "complete",
        lightCones: "complete",
        relics: "complete",
      },
      warnings: [],
    },
  });
}
