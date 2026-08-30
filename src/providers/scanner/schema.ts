import { z } from "zod";
import {
  type AccountSnapshot,
  AccountSnapshotSchema,
  type Character,
  type RelicSlot,
  StableIdSchema,
} from "@/domain/account/schemas";
import { assertNoSensitiveFields } from "@/lib/security";
import {
  HSR_REFERENCE_MANIFEST,
  loadCharacters,
  loadLightCones,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";
import type { HsrReferenceCatalog } from "@/providers/gilore/types";
import type { AccountImportDraft } from "../types";

const NativeScannerExportSchema = z
  .object({
    format: z.literal("ggstarrail-scanner-export"),
    schemaVersion: z.literal(1),
    sourceApp: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1),
      })
      .strict(),
    exportedAt: z.string().datetime(),
    account: AccountSnapshotSchema,
  })
  .strict();

const BilingualNameSchema = z
  .object({
    zhCn: z.string().min(1),
    en: z.string().min(1),
  })
  .strict();

const GoodScannerStatSchema = z
  .object({
    key: StableIdSchema,
    gameId: z.number().int().positive(),
    name: BilingualNameSchema,
    value: z.number().finite(),
  })
  .strict();

const GoodScannerCharacterSchema = z
  .object({
    localId: StableIdSchema,
    key: StableIdSchema,
    gameId: z.number().int().positive(),
    name: BilingualNameSchema,
    rarity: z.number().int().min(1).max(5),
    path: StableIdSchema,
    level: z.number().int().min(1).max(100),
    ascension: z.number().int().min(0).max(8),
    eidolon: z.number().int().min(0).max(6),
  })
  .strict();

const GoodScannerLightConeSchema = z
  .object({
    localId: StableIdSchema,
    key: StableIdSchema,
    gameId: z.number().int().positive(),
    name: BilingualNameSchema,
    rarity: z.number().int().min(1).max(5),
    path: StableIdSchema,
    level: z.number().int().min(1).max(100),
    ascension: z.number().int().min(0).max(8),
    superimposition: z.number().int().min(1).max(5),
    locationKey: StableIdSchema.nullable(),
    lock: z.boolean().nullable(),
  })
  .strict();

const GoodScannerGearSchema = z
  .object({
    localId: StableIdSchema,
    key: StableIdSchema,
    gameId: z.number().int().positive(),
    name: BilingualNameSchema,
    setKey: StableIdSchema,
    setName: BilingualNameSchema,
    rarity: z.number().int().min(1).max(5),
    slot: z.enum(["Head", "Hands", "Body", "Feet", "PlanarSphere", "LinkRope"]),
    level: z.number().int().min(0).max(15),
    mainStat: GoodScannerStatSchema,
    substats: z.array(GoodScannerStatSchema).max(5),
    locationKey: StableIdSchema.nullable(),
    lock: z.boolean().nullable(),
    discard: z.boolean().nullable(),
  })
  .strict();

export const GoodScannerExperimentalExportSchema = z
  .object({
    schema: z.literal("goodscanner.hsr.experimental"),
    schemaVersion: z.literal(1),
    source: z
      .object({
        kind: z.literal("sanitizedFixture"),
        revision: z.string().min(1),
      })
      .strict(),
    reference: z
      .object({
        schemaVersion: z.literal(1),
        provider: z.string().min(1),
        revision: z.string().min(1),
      })
      .strict(),
    privacy: z
      .object({
        accountIdentifiersIncluded: z.literal(false),
        rawPacketDataIncluded: z.literal(false),
      })
      .strict(),
    characters: z.array(GoodScannerCharacterSchema),
    lightCones: z.array(GoodScannerLightConeSchema),
    relics: z.array(GoodScannerGearSchema),
    planarOrnaments: z.array(GoodScannerGearSchema),
  })
  .strict();

export type GoodScannerExperimentalExport = z.infer<
  typeof GoodScannerExperimentalExportSchema
>;

export const SCANNER_WARNING_TRACES_NOT_INCLUDED =
  "SCANNER_V1_TRACES_NOT_INCLUDED";
export const SCANNER_WARNING_UNKNOWN_LOCK_DEFAULTED =
  "SCANNER_V1_UNKNOWN_LOCK_DEFAULTED_UNLOCKED";
export const SCANNER_WARNING_DISCARD_NOT_IMPORTED =
  "SCANNER_V1_DISCARD_STATE_NOT_IMPORTED";

type ScannerReferenceCatalog = Pick<
  HsrReferenceCatalog,
  | "manifest"
  | "characters"
  | "lightCones"
  | "relicSets"
  | "relicPieces"
  | "properties"
>;

const GOODSCANNER_SLOT_TO_DOMAIN = {
  Head: "head",
  Hands: "hands",
  Body: "body",
  Feet: "feet",
  PlanarSphere: "planarSphere",
  LinkRope: "linkRope",
} as const satisfies Record<
  GoodScannerExperimentalExport["relics"][number]["slot"],
  RelicSlot
>;

const CATALOG_SLOT_TO_DOMAIN = {
  HEAD: "head",
  HAND: "hands",
  BODY: "body",
  FOOT: "feet",
  NECK: "planarSphere",
  OBJECT: "linkRope",
} as const satisfies Record<
  HsrReferenceCatalog["relicPieces"][number]["slot"],
  RelicSlot
>;

const GOODSCANNER_STAT_ALIASES: Readonly<Record<string, string>> = {
  HPFlat: "HPDelta",
  ATKFlat: "AttackDelta",
  DEFFlat: "DefenceDelta",
  HPPercent: "HPAddedRatio",
  ATKPercent: "AttackAddedRatio",
  DEFPercent: "DefenceAddedRatio",
  Speed: "SpeedDelta",
  CRITRate: "CriticalChanceBase",
  CRITDMG: "CriticalDamageBase",
  EffectHitRate: "StatusProbabilityBase",
  EffectRES: "StatusResistanceBase",
  BreakEffect: "BreakDamageAddedRatioBase",
  EnergyRegenerationRate: "SPRatioBase",
  OutgoingHealingBoost: "HealRatioBase",
  PhysicalDMGBoost: "PhysicalAddedRatio",
  FireDMGBoost: "FireAddedRatio",
  IceDMGBoost: "IceAddedRatio",
  LightningDMGBoost: "ThunderAddedRatio",
  WindDMGBoost: "WindAddedRatio",
  QuantumDMGBoost: "QuantumAddedRatio",
  ImaginaryDMGBoost: "ImaginaryAddedRatio",
};

function ensureUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function requiredByPublicId<T extends { id: string }>(
  records: ReadonlyMap<string, T>,
  key: string,
  gameId: number,
  label: string
): T {
  const numericId = String(gameId);
  const byKey = records.get(key);
  const byGameId = records.get(numericId);
  if (byKey && byGameId && byKey.id !== byGameId.id) {
    throw new Error(
      `${label} identity mismatch between key ${key} and game ID ${numericId}`
    );
  }
  const record = byKey ?? byGameId;
  if (!record) {
    throw new Error(`Unknown ${label}: ${key} (${numericId})`);
  }
  if (record.id !== numericId) {
    throw new Error(
      `${label} game ID ${numericId} does not match catalog ID ${record.id}`
    );
  }
  return record;
}

function resolveStatId(
  key: string,
  propertyById: ReadonlyMap<string, HsrReferenceCatalog["properties"][number]>
): string {
  if (propertyById.has(key)) return key;
  const alias = GOODSCANNER_STAT_ALIASES[key];
  if (alias && propertyById.has(alias)) return alias;
  throw new Error(`Unknown Relic property: ${key}`);
}

function bindCharacterAlias(
  aliases: Map<string, string>,
  alias: string,
  characterKey: string
): void {
  const previous = aliases.get(alias);
  if (previous && previous !== characterKey) {
    throw new Error(`Ambiguous equipped Character reference: ${alias}`);
  }
  aliases.set(alias, characterKey);
}

export function isGoodScannerExperimentalExport(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  return (
    "schema" in input &&
    (input as { schema?: unknown }).schema === "goodscanner.hsr.experimental"
  );
}

export function parseScannerExport(input: unknown): AccountImportDraft {
  assertNoSensitiveFields(input);
  const parsed = NativeScannerExportSchema.parse(input);
  return {
    account: parsed.account,
    warnings: parsed.account.source.warnings,
  };
}

export function parseGoodScannerExperimentalExport(
  input: unknown,
  catalog: ScannerReferenceCatalog,
  now = new Date()
): AccountImportDraft {
  assertNoSensitiveFields(input);
  const parsed = GoodScannerExperimentalExportSchema.parse(input);

  if (parsed.reference.revision !== catalog.manifest.source.revision) {
    throw new Error(
      `Scanner reference revision ${parsed.reference.revision} does not match catalog revision ${catalog.manifest.source.revision}`
    );
  }

  const schemaMajor = Number.parseInt(
    catalog.manifest.schema_version.split(".")[0] ?? "",
    10
  );
  if (parsed.reference.schemaVersion !== schemaMajor) {
    throw new Error(
      `Scanner reference schema ${parsed.reference.schemaVersion} is incompatible with catalog schema ${catalog.manifest.schema_version}`
    );
  }

  ensureUnique(
    parsed.characters.map((character) => character.localId),
    "Character local ID"
  );
  ensureUnique(
    parsed.lightCones.map((lightCone) => lightCone.localId),
    "Light Cone local ID"
  );
  const allGear = [...parsed.relics, ...parsed.planarOrnaments];
  ensureUnique(
    allGear.map((relic) => relic.localId),
    "Relic local ID"
  );

  const characterById = new Map(
    catalog.characters.map((definition) => [definition.id, definition])
  );
  const lightConeById = new Map(
    catalog.lightCones.map((definition) => [definition.id, definition])
  );
  const relicPieceById = new Map(
    catalog.relicPieces.map((definition) => [definition.id, definition])
  );
  const relicSetById = new Map(
    catalog.relicSets.map((definition) => [definition.id, definition])
  );
  const propertyById = new Map(
    catalog.properties.map((definition) => [definition.id, definition])
  );

  const characterAliases = new Map<string, string>();
  const characters: Character[] = parsed.characters.map((record) => {
    const definition = requiredByPublicId(
      characterById,
      record.key,
      record.gameId,
      "Character"
    );
    if (record.rarity !== definition.rarity) {
      throw new Error(`Character rarity mismatch for ${definition.id}`);
    }
    if (record.path !== definition.path_id) {
      throw new Error(`Character Path mismatch for ${definition.id}`);
    }
    const character: Character = {
      key: record.localId,
      definitionId: definition.id,
      pathId: definition.path_id,
      combatTypeId: definition.combat_type_id,
      level: record.level,
      ascension: record.ascension,
      eidolon: record.eidolon,
      traces: {},
      relicKeys: [],
    };
    for (const alias of [
      record.localId,
      record.key,
      String(record.gameId),
      definition.id,
    ]) {
      bindCharacterAlias(characterAliases, alias, character.key);
    }
    return character;
  });
  ensureUnique(
    characters.map((character) => character.definitionId),
    "Character definition"
  );
  const characterByKey = new Map(
    characters.map((character) => [character.key, character])
  );

  const resolveLocation = (locationKey: string | null): string | undefined => {
    if (locationKey === null) return undefined;
    const characterKey = characterAliases.get(locationKey);
    if (!characterKey) {
      throw new Error(`Unknown equipped Character reference: ${locationKey}`);
    }
    return characterKey;
  };

  const lightCones = parsed.lightCones.map((record) => {
    const definition = requiredByPublicId(
      lightConeById,
      record.key,
      record.gameId,
      "Light Cone"
    );
    if (record.rarity !== definition.rarity) {
      throw new Error(`Light Cone rarity mismatch for ${definition.id}`);
    }
    if (record.path !== definition.path_id) {
      throw new Error(`Light Cone Path mismatch for ${definition.id}`);
    }
    const equippedCharacterKey = resolveLocation(record.locationKey);
    const lightCone = {
      key: record.localId,
      definitionId: definition.id,
      pathId: definition.path_id,
      level: record.level,
      ascension: record.ascension,
      superimposition: record.superimposition,
      locked: record.lock ?? false,
      ...(equippedCharacterKey ? { equippedCharacterKey } : {}),
    };
    if (equippedCharacterKey) {
      const character = characterByKey.get(equippedCharacterKey);
      if (!character) {
        throw new Error(
          `Missing equipped Character instance: ${equippedCharacterKey}`
        );
      }
      if (character.lightConeKey) {
        throw new Error(
          `Multiple Light Cones are equipped to ${equippedCharacterKey}`
        );
      }
      character.lightConeKey = lightCone.key;
    }
    return lightCone;
  });

  const relics = allGear.map((record) => {
    const definition = requiredByPublicId(
      relicPieceById,
      record.key,
      record.gameId,
      "Relic piece"
    );
    if (record.setKey !== definition.set_id) {
      const scannerSet = relicSetById.get(record.setKey);
      if (!scannerSet || scannerSet.id !== definition.set_id) {
        throw new Error(`Relic set mismatch for ${definition.id}`);
      }
    }
    if (record.rarity !== definition.rarity) {
      throw new Error(`Relic rarity mismatch for ${definition.id}`);
    }
    const scannerSlot = GOODSCANNER_SLOT_TO_DOMAIN[record.slot];
    const catalogSlot = CATALOG_SLOT_TO_DOMAIN[definition.slot];
    if (scannerSlot !== catalogSlot) {
      throw new Error(`Relic slot mismatch for ${definition.id}`);
    }
    const equippedCharacterKey = resolveLocation(record.locationKey);
    const relic = {
      key: record.localId,
      definitionId: definition.id,
      setId: definition.set_id,
      slot: catalogSlot,
      rarity: record.rarity,
      level: record.level,
      mainStat: {
        statId: resolveStatId(record.mainStat.key, propertyById),
        value: record.mainStat.value,
      },
      substats: record.substats.map((stat) => ({
        statId: resolveStatId(stat.key, propertyById),
        value: stat.value,
      })),
      locked: record.lock ?? false,
      ...(equippedCharacterKey ? { equippedCharacterKey } : {}),
    };
    if (equippedCharacterKey) {
      const character = characterByKey.get(equippedCharacterKey);
      if (!character) {
        throw new Error(
          `Missing equipped Character instance: ${equippedCharacterKey}`
        );
      }
      character.relicKeys.push(relic.key);
    }
    return relic;
  });

  const warnings = [SCANNER_WARNING_TRACES_NOT_INCLUDED];
  if (
    parsed.lightCones.some((lightCone) => lightCone.lock === null) ||
    allGear.some((relic) => relic.lock === null)
  ) {
    warnings.push(SCANNER_WARNING_UNKNOWN_LOCK_DEFAULTED);
  }
  if (allGear.some((relic) => relic.discard !== false)) {
    warnings.push(SCANNER_WARNING_DISCARD_NOT_IMPORTED);
  }

  const account: AccountSnapshot = AccountSnapshotSchema.parse({
    schemaVersion: 1,
    profileId: "scanner:local",
    characters,
    lightCones,
    relics,
    source: {
      provider: "scanner-export",
      formatVersion: parsed.schemaVersion,
      sourceVersion: `goodscanner-hsr-experimental-v${parsed.schemaVersion}`,
      sourceRevision: parsed.reference.revision,
      importedAt: now.toISOString(),
      warnings,
    },
  });

  return { account, warnings };
}

export async function parseVersionedScannerExport(
  input: unknown,
  now = new Date()
): Promise<AccountImportDraft> {
  assertNoSensitiveFields(input);
  if (!isGoodScannerExperimentalExport(input)) {
    return parseScannerExport(input);
  }

  const [characters, lightCones, relicSets, relicPieces, propertyTables] =
    await Promise.all([
      loadCharacters(),
      loadLightCones(),
      loadRelicSets(),
      loadRelicPieces(),
      loadPropertyTables(),
    ]);

  return parseGoodScannerExperimentalExport(
    input,
    {
      manifest: HSR_REFERENCE_MANIFEST,
      characters: characters.values,
      lightCones: lightCones.values,
      relicSets: relicSets.values,
      relicPieces: relicPieces.values,
      properties: propertyTables.properties,
    },
    now
  );
}
