import { z } from "zod";
import {
  type AccountSnapshot,
  AccountSnapshotSchema,
  AccountSnapshotV1Schema,
  AccountSnapshotV2Schema,
  AchievementCaptureRevisionSchema,
  type AchievementCompletion,
  AchievementCompletionSchema,
  AchievementIdSchema,
  type Character,
  ImportCoverageSchema,
  migrateAccountSnapshotV1,
  migrateAccountSnapshotV2,
  type RelicSlot,
  StableIdSchema,
} from "@/domain/account/schemas";
import { assertNoSensitiveFields } from "@/lib/security";
import {
  HSR_REFERENCE_MANIFEST,
  loadAchievementIds,
  loadCharacters,
  loadLightCones,
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";
import type {
  HsrReferenceCatalog,
  ProgressionTables,
} from "@/providers/gilore/types";
import { validateRelicMainStatDisplayValue } from "@/providers/relicMainStat";
import type { AccountImportDraft } from "../types";
import {
  isInteroperableScannerV4Export,
  parseInteroperableScannerV4Export,
} from "./interopV4";
import { validateNativeScannerAccount } from "./nativeValidation";
import { canonicalVisibleRelicPiece } from "./visibleRelicIdentity";

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
    account: z.union([
      AccountSnapshotSchema,
      AccountSnapshotV2Schema,
      AccountSnapshotV1Schema,
    ]),
  })
  .strict();

const BilingualNameSchema = z
  .object({
    zhCn: z.string().min(1),
    en: z.string().min(1),
  })
  .strict();

const GoodScannerStatV1Schema = z
  .object({
    key: StableIdSchema,
    gameId: z.number().int().positive(),
    name: BilingualNameSchema,
    value: z.number().finite(),
  })
  .strict();

const GoodScannerStatV2Schema = z
  .object({
    key: StableIdSchema,
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

const GoodScannerSlotSchema = z.enum([
  "Head",
  "Hands",
  "Body",
  "Feet",
  "PlanarSphere",
  "LinkRope",
]);

const GoodScannerGearIdentitySchema = z
  .object({
    localId: StableIdSchema,
    key: StableIdSchema,
    gameId: z.number().int().positive(),
    name: BilingualNameSchema,
    setKey: StableIdSchema,
    setName: BilingualNameSchema,
    rarity: z.number().int().min(1).max(5),
    slot: GoodScannerSlotSchema,
    level: z.number().int().min(0).max(15),
    locationKey: StableIdSchema.nullable(),
    lock: z.boolean().nullable(),
    discard: z.boolean().nullable(),
  })
  .strict();

const GoodScannerGearV1Schema = GoodScannerGearIdentitySchema.extend({
  mainStat: GoodScannerStatV1Schema,
  substats: z.array(GoodScannerStatV1Schema).max(4),
});

const GoodScannerGearV2Schema = GoodScannerGearIdentitySchema.extend({
  mainStat: GoodScannerStatV2Schema,
  substats: z.array(GoodScannerStatV2Schema).max(4),
});

const ScannerCoverageSchema = z
  .object({
    characters: ImportCoverageSchema,
    lightCones: ImportCoverageSchema,
    relics: ImportCoverageSchema,
  })
  .strict();

export const GoodScannerExperimentalExportV1Schema = z
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
    relics: z.array(GoodScannerGearV1Schema),
    planarOrnaments: z.array(GoodScannerGearV1Schema),
  })
  .strict();

export const GoodScannerExperimentalExportV2Schema = z
  .object({
    schema: z.literal("goodscanner.hsr.experimental"),
    schemaVersion: z.literal(2),
    source: z
      .object({
        kind: z.enum(["screenCapture", "packetCapture", "sanitizedFixture"]),
        revision: z.string().min(1),
        coverage: ScannerCoverageSchema,
      })
      .strict(),
    reference: z
      .object({
        schemaVersion: z.literal(1),
        provider: z.literal("gilore.ggstarrail-reference"),
        revision: z.string().min(1),
      })
      .strict(),
    privacy: z
      .object({
        accountIdentifiersIncluded: z.literal(false),
        rawPacketDataIncluded: z.literal(false),
        serverItemIdentifiersIncluded: z.literal(false),
      })
      .strict(),
    characters: z.array(GoodScannerCharacterSchema),
    lightCones: z.array(GoodScannerLightConeSchema),
    relics: z.array(GoodScannerGearV2Schema),
    planarOrnaments: z.array(GoodScannerGearV2Schema),
  })
  .strict();

const GoodScannerAchievementEntryV3Schema = z
  .object({
    achievementId: AchievementIdSchema,
    status: z.literal("completed"),
  })
  .strict();

const GoodScannerAchievementEntriesV3Schema = z
  .array(GoodScannerAchievementEntryV3Schema)
  .superRefine((entries, context) => {
    const seen = new Set<number>();
    entries.forEach((entry, index) => {
      if (seen.has(entry.achievementId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate completed achievement ID: ${entry.achievementId}`,
          path: [index, "achievementId"],
        });
      }
      const previous = entries[index - 1];
      if (previous && entry.achievementId < previous.achievementId) {
        context.addIssue({
          code: "custom",
          message: "Completed achievement entries must be sorted ascending",
          path: [index, "achievementId"],
        });
      }
      seen.add(entry.achievementId);
    });
  });

export const GoodScannerHsrExportV3Schema = z
  .object({
    schema: z.literal("goodscanner.hsr"),
    schemaVersion: z.literal(3),
    source: z
      .object({
        kind: z.enum(["screenCapture", "packetCapture", "sanitizedFixture"]),
        revision: z.string().min(1),
        coverage: ScannerCoverageSchema,
      })
      .strict(),
    reference: z
      .object({
        schemaVersion: z.literal(1),
        provider: z.literal("gilore.ggstarrail-reference"),
        revision: z.string().min(1),
      })
      .strict(),
    privacy: z
      .object({
        accountIdentifiersIncluded: z.literal(false),
        rawPacketDataIncluded: z.literal(false),
        serverItemIdentifiersIncluded: z.literal(false),
      })
      .strict(),
    characters: z.array(GoodScannerCharacterSchema),
    lightCones: z.array(GoodScannerLightConeSchema),
    relics: z.array(GoodScannerGearV2Schema),
    planarOrnaments: z.array(GoodScannerGearV2Schema),
    achievements: z
      .object({
        source: z
          .object({
            kind: z.literal("packetCapture"),
            revision: AchievementCaptureRevisionSchema,
          })
          .strict(),
        coverage: z.literal("complete"),
        entries: GoodScannerAchievementEntriesV3Schema,
      })
      .strict()
      .optional(),
  })
  .strict();

export const GoodScannerExperimentalExportSchema = z.discriminatedUnion(
  "schemaVersion",
  [GoodScannerExperimentalExportV1Schema, GoodScannerExperimentalExportV2Schema]
);

export const GoodScannerHsrExportSchema = z.discriminatedUnion(
  "schemaVersion",
  [
    GoodScannerExperimentalExportV1Schema,
    GoodScannerExperimentalExportV2Schema,
    GoodScannerHsrExportV3Schema,
  ]
);

export type GoodScannerExperimentalExport = z.infer<
  typeof GoodScannerExperimentalExportSchema
>;

export const SCANNER_WARNING_TRACES_NOT_INCLUDED =
  "SCANNER_TRACES_NOT_INCLUDED";
export const SCANNER_WARNING_UNKNOWN_LOCK_STATE = "SCANNER_LOCK_STATE_PARTIAL";
export const SCANNER_WARNING_UNKNOWN_DISCARD_STATE =
  "SCANNER_DISCARD_STATE_PARTIAL";
export const SCANNER_WARNING_REFERENCE_REVISION_MISMATCH =
  "SCANNER_REFERENCE_REVISION_MISMATCH";
export const SCANNER_WARNING_V1_COVERAGE_UNKNOWN =
  "SCANNER_V1_COVERAGE_UNKNOWN";
export const SCANNER_WARNING_PARTIAL_COVERAGE = "SCANNER_PARTIAL_COVERAGE";
export const SCANNER_WARNING_SANITIZED_FIXTURE =
  "SCANNER_SANITIZED_FIXTURE_SOURCE";

/** @deprecated Use SCANNER_WARNING_UNKNOWN_LOCK_STATE. */
export const SCANNER_WARNING_UNKNOWN_LOCK_DEFAULTED =
  SCANNER_WARNING_UNKNOWN_LOCK_STATE;
/** @deprecated Use SCANNER_WARNING_UNKNOWN_DISCARD_STATE. */
export const SCANNER_WARNING_DISCARD_NOT_IMPORTED =
  SCANNER_WARNING_UNKNOWN_DISCARD_STATE;

type ScannerReferenceCatalog = Pick<
  HsrReferenceCatalog,
  | "manifest"
  | "characters"
  | "lightCones"
  | "relicSets"
  | "relicPieces"
  | "properties"
> & {
  progression: ProgressionTables;
  achievementIds: ReadonlySet<number>;
};

const GOODSCANNER_SLOT_TO_DOMAIN = {
  Head: "head",
  Hands: "hands",
  Body: "body",
  Feet: "feet",
  PlanarSphere: "planarSphere",
  LinkRope: "linkRope",
} as const satisfies Record<z.infer<typeof GoodScannerSlotSchema>, RelicSlot>;

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

function resolveGearStats(
  record: {
    mainStat: { key: string; value: number };
    substats: readonly { key: string; value: number }[];
  },
  propertyById: ReadonlyMap<string, HsrReferenceCatalog["properties"][number]>
): {
  mainStat: { statId: string; value: number };
  substats: { statId: string; value: number }[];
} {
  const mainStatId = resolveStatId(record.mainStat.key, propertyById);
  const seenSubstats = new Set<string>();
  const substats = record.substats.map((stat) => {
    const statId = resolveStatId(stat.key, propertyById);
    if (statId === mainStatId) {
      throw new Error(
        `Relic property ${statId} cannot be both main and substat`
      );
    }
    if (seenSubstats.has(statId)) {
      throw new Error(`Duplicate Relic substat property: ${statId}`);
    }
    seenSubstats.add(statId);
    return { statId, value: stat.value };
  });
  return {
    mainStat: { statId: mainStatId, value: record.mainStat.value },
    substats,
  };
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

export function isGoodScannerHsrExport(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const schema = (input as { schema?: unknown }).schema;
  return (
    schema === "goodscanner.hsr.experimental" || schema === "goodscanner.hsr"
  );
}

export function parseScannerExport(input: unknown): AccountImportDraft {
  assertNoSensitiveFields(input);
  const parsed = NativeScannerExportSchema.parse(input);
  const account =
    parsed.account.schemaVersion === 1
      ? migrateAccountSnapshotV1(parsed.account)
      : parsed.account.schemaVersion === 2
        ? migrateAccountSnapshotV2(parsed.account)
        : parsed.account;
  return {
    account,
    warnings: account.source.warnings,
  };
}

export function parseGoodScannerExperimentalExport(
  input: unknown,
  catalog: ScannerReferenceCatalog,
  now = new Date()
): AccountImportDraft {
  assertNoSensitiveFields(input);
  const parsed = GoodScannerHsrExportSchema.parse(input);

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
      locked: record.lock,
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
    const suppliedDefinition = requiredByPublicId(
      relicPieceById,
      record.key,
      record.gameId,
      "Relic piece"
    );
    if (record.setKey !== suppliedDefinition.set_id) {
      const scannerSet = relicSetById.get(record.setKey);
      if (!scannerSet || scannerSet.id !== suppliedDefinition.set_id) {
        throw new Error(`Relic set mismatch for ${suppliedDefinition.id}`);
      }
    }
    if (record.rarity !== suppliedDefinition.rarity) {
      throw new Error(`Relic rarity mismatch for ${suppliedDefinition.id}`);
    }
    const scannerSlot = GOODSCANNER_SLOT_TO_DOMAIN[record.slot];
    const catalogSlot = CATALOG_SLOT_TO_DOMAIN[suppliedDefinition.slot];
    if (scannerSlot !== catalogSlot) {
      throw new Error(`Relic slot mismatch for ${suppliedDefinition.id}`);
    }
    const equippedCharacterKey = resolveLocation(record.locationKey);
    const { mainStat, substats } = resolveGearStats(record, propertyById);
    const definition = canonicalVisibleRelicPiece(
      {
        setId: suppliedDefinition.set_id,
        slot: suppliedDefinition.slot,
        rarity: suppliedDefinition.rarity,
        mainPropertyId: mainStat.statId,
      },
      catalog,
      suppliedDefinition
    );
    if (record.level > definition.max_level) {
      throw new Error(
        `Relic level ${record.level} exceeds definition ${definition.id} maximum ${definition.max_level}`
      );
    }
    validateRelicMainStatDisplayValue(
      definition,
      mainStat,
      record.level,
      catalog.properties,
      catalog.progression.relic_main_affixes
    );
    const relic = {
      key: record.localId,
      definitionId: definition.id,
      setId: definition.set_id,
      slot: catalogSlot,
      rarity: record.rarity,
      level: record.level,
      mainStat,
      substats,
      locked: record.lock,
      discarded: record.discard,
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

  const coverage =
    parsed.schemaVersion === 1
      ? {
          characters: "unknown" as const,
          lightCones: "unknown" as const,
          relics: "unknown" as const,
        }
      : parsed.source.coverage;
  const warnings: string[] = [SCANNER_WARNING_TRACES_NOT_INCLUDED];
  if (parsed.schemaVersion === 1) {
    warnings.push(SCANNER_WARNING_V1_COVERAGE_UNKNOWN);
  } else if (Object.values(coverage).some((value) => value !== "complete")) {
    warnings.push(SCANNER_WARNING_PARTIAL_COVERAGE);
  }
  if (parsed.source.kind === "sanitizedFixture") {
    warnings.push(SCANNER_WARNING_SANITIZED_FIXTURE);
  }
  if (parsed.reference.revision !== catalog.manifest.source.revision) {
    warnings.push(SCANNER_WARNING_REFERENCE_REVISION_MISMATCH);
  }
  if (
    parsed.lightCones.some((lightCone) => lightCone.lock === null) ||
    allGear.some((relic) => relic.lock === null)
  ) {
    warnings.push(SCANNER_WARNING_UNKNOWN_LOCK_STATE);
  }
  if (allGear.some((relic) => relic.discard === null)) {
    warnings.push(SCANNER_WARNING_UNKNOWN_DISCARD_STATE);
  }

  let achievementCompletion: AchievementCompletion | undefined;
  if (parsed.schemaVersion === 3 && parsed.achievements !== undefined) {
    if (!catalog.achievementIds) {
      throw new Error("Scanner achievement reference is unavailable");
    }
    const completedIds = parsed.achievements.entries.map(
      ({ achievementId }) => achievementId
    );
    for (const achievementId of completedIds) {
      if (!catalog.achievementIds.has(achievementId)) {
        throw new Error(`Unknown HSR achievement: ${achievementId}`);
      }
    }
    achievementCompletion = AchievementCompletionSchema.parse({
      completedIds: [...completedIds].sort((left, right) => left - right),
      capture: {
        coverage: parsed.achievements.coverage,
        source: parsed.achievements.source,
        importedAt: now.toISOString(),
      },
    });
  }

  const account: AccountSnapshot = AccountSnapshotSchema.parse({
    schemaVersion: 3,
    profileId: "scanner:local",
    characters,
    lightCones,
    relics,
    ...(achievementCompletion ? { achievementCompletion } : {}),
    source: {
      provider: "scanner-export",
      formatVersion: parsed.schemaVersion,
      sourceVersion:
        parsed.schemaVersion === 3
          ? "goodscanner-hsr-v3"
          : `goodscanner-hsr-experimental-v${parsed.schemaVersion}`,
      sourceRevision: parsed.reference.revision,
      importedAt: now.toISOString(),
      coverage,
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
  const isGoodScanner = isGoodScannerHsrExport(input);
  const isInteroperableV4 = isInteroperableScannerV4Export(input);
  const nativeDraft =
    !isGoodScanner && !isInteroperableV4 ? parseScannerExport(input) : null;

  const [
    characters,
    lightCones,
    relicSets,
    relicPieces,
    propertyTables,
    progression,
    achievementIds,
  ] = await Promise.all([
    loadCharacters(),
    loadLightCones(),
    loadRelicSets(),
    loadRelicPieces(),
    loadPropertyTables(),
    loadProgression(),
    loadAchievementIds(),
  ]);

  const catalog: ScannerReferenceCatalog = {
    manifest: HSR_REFERENCE_MANIFEST,
    characters: characters.values,
    lightCones: lightCones.values,
    relicSets: relicSets.values,
    relicPieces: relicPieces.values,
    properties: propertyTables.properties,
    progression,
    achievementIds,
  };

  if (nativeDraft) {
    validateNativeScannerAccount(nativeDraft.account, catalog);
    return nativeDraft;
  }

  if (isInteroperableV4) {
    return parseInteroperableScannerV4Export(input, catalog, now);
  }

  return parseGoodScannerExperimentalExport(input, catalog, now);
}
