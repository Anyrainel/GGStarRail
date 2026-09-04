import { z } from "zod";
import {
  type AccountSnapshot,
  AccountSnapshotSchema,
  type Character,
  ImportCoverageSchema,
  type Relic,
  type RelicSlot,
} from "@/domain/account/schemas";
import { assertNoSensitiveFields } from "@/lib/security";
import type {
  HsrReferenceCatalog,
  ProgressionTables,
  PropertyDefinition,
  RelicPieceDefinition,
} from "@/providers/gilore/types";
import { accountStatValue } from "../accountNormalization";
import type { AccountImportDraft } from "../types";
import { canonicalVisibleRelicPiece } from "./visibleRelicIdentity";

const V4CoverageSchema = z
  .object({
    characters: ImportCoverageSchema,
    lightCones: ImportCoverageSchema,
    relics: ImportCoverageSchema,
  })
  .strict();

const V4SubstatSchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    value: z.number().finite(),
    count: z.number().int().positive().optional(),
    step: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const V4LightConeSchema = z
  .object({
    id: z.string().regex(/^\d+$/),
    name: z.string().optional(),
    level: z.number().int().min(1).max(100),
    ascension: z.number().int().min(0).max(8),
    superimposition: z.number().int().min(1).max(5),
    location: z.string(),
    lock: z.boolean().nullable().optional(),
    _uid: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

const V4RelicSchema = z
  .object({
    set_id: z.string().regex(/^\d+$/),
    name: z.string().optional(),
    slot: z.string().trim().min(1).max(32),
    rarity: z.number().int().min(1).max(5),
    level: z.number().int().min(0).max(15),
    mainstat: z.string().trim().min(1).max(64),
    substats: z.array(V4SubstatSchema).max(4),
    reroll_substats: z.array(V4SubstatSchema).max(4).optional(),
    preview_substats: z.array(V4SubstatSchema).max(4).optional(),
    location: z.string(),
    lock: z.boolean().nullable().optional(),
    discard: z.boolean().nullable().optional(),
    _uid: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

const V4CharacterSchema = z
  .object({
    id: z.string().regex(/^\d+$/),
    name: z.string().optional(),
    path: z.string().trim().min(1).max(64),
    level: z.number().int().min(1).max(100),
    ascension: z.number().int().min(0).max(8),
    eidolon: z.number().int().min(0).max(6),
    ability_version: z.number().int().nonnegative().optional(),
    skills: z.record(z.string(), z.number().int().nonnegative()).optional(),
    traces: z.record(z.string(), z.boolean()).optional(),
    memosprite: z.record(z.string(), z.number().int().nonnegative()).optional(),
  })
  .passthrough();

export const InteroperableScannerV4Schema = z
  .object({
    source: z.string().trim().min(1).max(128),
    build: z.string().trim().min(1).max(128),
    version: z.literal(4),
    metadata: z
      .object({
        uid: z
          .union([
            z.string().regex(/^\d{8,12}$/),
            z.number().int().positive(),
            z.literal(0),
          ])
          .nullable()
          .optional(),
        trailblazer: z.string().nullable().optional(),
        current_trailblazer_path: z.string().optional(),
      })
      .passthrough(),
    coverage: V4CoverageSchema.optional(),
    light_cones: z.array(V4LightConeSchema),
    relics: z.array(V4RelicSchema),
    characters: z.array(V4CharacterSchema),
  })
  .passthrough();

export type InteroperableScannerV4 = z.infer<
  typeof InteroperableScannerV4Schema
>;

type V4SourceKind = "fribbels" | "hsr-scanner" | "kel" | "reliquary";

export interface InteroperableScannerCatalog extends HsrReferenceCatalog {
  progression: ProgressionTables;
}

export const SCANNER_WARNING_V4_COVERAGE_UNKNOWN =
  "SCANNER_V4_COVERAGE_UNKNOWN";
export const SCANNER_WARNING_V4_PREVIEW_STATS_OMITTED =
  "SCANNER_V4_PREVIEW_STATS_OMITTED";
export const SCANNER_WARNING_V4_EQUIPPED_CHARACTER_MISSING =
  "SCANNER_V4_EQUIPPED_CHARACTER_MISSING";
export const SCANNER_WARNING_V4_TRACES_PARTIAL = "SCANNER_V4_TRACES_PARTIAL";

const SLOT_ALIASES: Readonly<Record<string, RelicSlot>> = {
  head: "head",
  hands: "hands",
  body: "body",
  feet: "feet",
  planarsphere: "planarSphere",
  linkrope: "linkRope",
};

const DOMAIN_TO_CATALOG_SLOT: Readonly<
  Record<RelicSlot, RelicPieceDefinition["slot"]>
> = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
};

const MAIN_STAT_ALIASES: Readonly<Record<string, string>> = {
  hp: "HPAddedRatio",
  atk: "AttackAddedRatio",
  def: "DefenceAddedRatio",
  spd: "SpeedDelta",
  critrate: "CriticalChanceBase",
  critdmg: "CriticalDamageBase",
  effecthitrate: "StatusProbabilityBase",
  breakeffect: "BreakDamageAddedRatioBase",
  outgoinghealingboost: "HealRatioBase",
  energyregenerationrate: "SPRatioBase",
  physicaldmgboost: "PhysicalAddedRatio",
  firedmgboost: "FireAddedRatio",
  icedmgboost: "IceAddedRatio",
  lightningdmgboost: "ThunderAddedRatio",
  winddmgboost: "WindAddedRatio",
  quantumdmgboost: "QuantumAddedRatio",
  imaginarydmgboost: "ImaginaryAddedRatio",
};

const SUBSTAT_ALIASES: Readonly<Record<string, string>> = {
  hp: "HPDelta",
  atk: "AttackDelta",
  def: "DefenceDelta",
  spd: "SpeedDelta",
  hp_: "HPAddedRatio",
  atk_: "AttackAddedRatio",
  def_: "DefenceAddedRatio",
  critrate_: "CriticalChanceBase",
  critdmg_: "CriticalDamageBase",
  effecthitrate_: "StatusProbabilityBase",
  effectres_: "StatusResistanceBase",
  breakeffect_: "BreakDamageAddedRatioBase",
};

const PATH_ALIASES: Readonly<Record<string, string>> = {
  destruction: "Warrior",
  warrior: "Warrior",
  hunt: "Rogue",
  rogue: "Rogue",
  erudition: "Mage",
  mage: "Mage",
  harmony: "Shaman",
  shaman: "Shaman",
  nihility: "Warlock",
  warlock: "Warlock",
  preservation: "Knight",
  knight: "Knight",
  abundance: "Priest",
  priest: "Priest",
  remembrance: "Memory",
  memory: "Memory",
  elation: "Elation",
};

function normalizedLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function classifySource(source: string): V4SourceKind {
  const normalized = normalizedLabel(source);
  if (normalized.includes("reliquary")) return "reliquary";
  if (normalized === "hsrscanner" || normalized.includes("starrailscanner")) {
    return "hsr-scanner";
  }
  if (normalized.startsWith("kel")) return "kel";
  if (normalized.includes("fribbels")) return "fribbels";
  throw new Error(`Unsupported interoperable HSR scanner source: ${source}`);
}

function assertNoDeviceOrServerIdentifiers(
  value: unknown,
  path = "$root"
): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoDeviceOrServerIdentifiers(entry, `${path}[${index}]`);
    });
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (/^(device|server).*id$/i.test(key.replace(/[-_]/g, ""))) {
      throw new Error(`Private identifier is not allowed at ${path}.${key}`);
    }
    assertNoDeviceOrServerIdentifiers(entry, `${path}.${key}`);
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalVisibleIdentity(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalVisibleIdentity).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${canonicalVisibleIdentity(entry)}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

async function makeInstanceKeys(
  namespace: "light-cone" | "relic",
  records: readonly { sourceIdentity: unknown; visibleIdentity: unknown }[],
  sourceKind: V4SourceKind
): Promise<string[]> {
  const occurrences = new Map<string, number>();
  return Promise.all(
    records.map(async ({ sourceIdentity, visibleIdentity }) => {
      const canUseSourceIdentity =
        sourceKind === "reliquary" &&
        sourceIdentity !== undefined &&
        sourceIdentity !== null &&
        String(sourceIdentity).length > 0;
      const identity = canUseSourceIdentity
        ? `source:${String(sourceIdentity)}`
        : `visible:${canonicalVisibleIdentity(visibleIdentity)}`;
      const occurrence = occurrences.get(identity) ?? 0;
      occurrences.set(identity, occurrence + 1);
      const digest = await sha256(
        `${sourceKind}:${namespace}:${identity}:${occurrence}`
      );
      return `v4:${namespace}:${digest.slice(0, 32)}`;
    })
  );
}

function resolveSlot(value: string): RelicSlot {
  const slot = SLOT_ALIASES[normalizedLabel(value)];
  if (!slot) throw new Error(`Unknown v4 Relic slot: ${value}`);
  return slot;
}

function resolvePropertyId(
  key: string,
  aliases: Readonly<Record<string, string>>,
  propertyById: ReadonlyMap<string, PropertyDefinition>,
  label: string
): string {
  if (propertyById.has(key)) return key;
  const propertyId = aliases[normalizedLabel(key)];
  if (!propertyId || !propertyById.has(propertyId)) {
    throw new Error(`Unknown v4 ${label}: ${key}`);
  }
  return propertyId;
}

function resolveMainPropertyId(
  rawKey: string,
  slot: RelicSlot,
  propertyById: ReadonlyMap<string, PropertyDefinition>
): string {
  if (slot === "head") {
    const normalized = normalizedLabel(rawKey);
    if (normalized !== "hp" && rawKey !== "HPDelta") {
      throw new Error(`Head main stat must be HP, received ${rawKey}`);
    }
    return "HPDelta";
  }
  if (slot === "hands") {
    const normalized = normalizedLabel(rawKey);
    if (normalized !== "atk" && rawKey !== "AttackDelta") {
      throw new Error(`Hands main stat must be ATK, received ${rawKey}`);
    }
    return "AttackDelta";
  }
  return resolvePropertyId(
    rawKey,
    MAIN_STAT_ALIASES,
    propertyById,
    "Relic main stat"
  );
}

function findRelicPiece(
  record: z.infer<typeof V4RelicSchema>,
  slot: RelicSlot,
  mainPropertyId: string,
  catalog: InteroperableScannerCatalog
): RelicPieceDefinition {
  const piece = canonicalVisibleRelicPiece(
    {
      setId: record.set_id,
      slot: DOMAIN_TO_CATALOG_SLOT[slot],
      rarity: record.rarity,
      mainPropertyId,
    },
    catalog
  );
  if (record.level > piece.max_level) {
    throw new Error(
      `Relic level ${record.level} exceeds rarity ${record.rarity} maximum ${piece.max_level}`
    );
  }
  return piece;
}

function mainStatValue(
  piece: RelicPieceDefinition,
  propertyId: string,
  level: number,
  catalog: InteroperableScannerCatalog
): number {
  const affix = catalog.progression.relic_main_affixes.find(
    (candidate) =>
      candidate.group_id === piece.main_affix_group &&
      candidate.property_id === propertyId
  );
  const property = catalog.properties.find(
    (candidate) => candidate.id === propertyId
  );
  if (!affix || !property) {
    throw new Error(`Missing generated main-affix data for ${propertyId}`);
  }
  const rawValue = affix.level_values[level];
  if (rawValue === undefined) {
    throw new Error(
      `Missing generated main-affix level ${level} for ${propertyId}`
    );
  }
  return accountStatValue(property, rawValue);
}

function characterTraces(
  record: z.infer<typeof V4CharacterSchema>
): Record<string, number> {
  const traces: Record<string, number> = {};
  for (const [key, value] of Object.entries(record.skills ?? {})) {
    traces[`skill:${key}`] = value;
  }
  for (const [key, value] of Object.entries(record.traces ?? {})) {
    traces[`trace:${key}`] = value ? 1 : 0;
  }
  for (const [key, value] of Object.entries(record.memosprite ?? {})) {
    traces[`memosprite:${key}`] = value;
  }
  if (record.ability_version !== undefined) {
    traces["source:abilityVersion"] = record.ability_version;
  }
  return traces;
}

function unknownCoverage(): z.infer<typeof V4CoverageSchema> {
  return {
    characters: "unknown",
    lightCones: "unknown",
    relics: "unknown",
  };
}

export function isInteroperableScannerV4Export(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Record<string, unknown>;
  return (
    candidate.version === 4 &&
    Array.isArray(candidate.characters) &&
    Array.isArray(candidate.light_cones) &&
    Array.isArray(candidate.relics)
  );
}

export async function parseInteroperableScannerV4Export(
  input: unknown,
  catalog: InteroperableScannerCatalog,
  now = new Date()
): Promise<AccountImportDraft> {
  assertNoSensitiveFields(input);
  assertNoDeviceOrServerIdentifiers(input);
  const parsed = InteroperableScannerV4Schema.parse(input);
  const sourceKind = classifySource(parsed.source);
  const characterById = new Map(
    catalog.characters.map((definition) => [definition.id, definition])
  );
  const lightConeById = new Map(
    catalog.lightCones.map((definition) => [definition.id, definition])
  );
  const propertyById = new Map(
    catalog.properties.map((definition) => [definition.id, definition])
  );

  const seenCharacters = new Set<string>();
  const characters: Character[] = parsed.characters.map((record) => {
    const definition = characterById.get(record.id);
    if (!definition) throw new Error(`Unknown v4 Character: ${record.id}`);
    if (seenCharacters.has(definition.id)) {
      throw new Error(`Duplicate v4 Character: ${definition.id}`);
    }
    seenCharacters.add(definition.id);
    const scannerPath = PATH_ALIASES[normalizedLabel(record.path)];
    if (scannerPath && scannerPath !== definition.path_id) {
      throw new Error(`Character Path mismatch for ${definition.id}`);
    }
    return {
      key: `v4:character:${definition.id}`,
      definitionId: definition.id,
      pathId: definition.path_id,
      combatTypeId: definition.combat_type_id,
      level: record.level,
      ascension: record.ascension,
      eidolon: record.eidolon,
      traces: characterTraces(record),
      relicKeys: [],
    };
  });
  const characterKeyByDefinition = new Map(
    characters.map((character) => [character.definitionId, character.key])
  );
  const characterByKey = new Map(
    characters.map((character) => [character.key, character])
  );
  let missingLightConeCharacter = false;
  let missingRelicCharacter = false;
  const resolveLocation = (
    location: string,
    section: "lightCones" | "relics"
  ): string | undefined => {
    if (location.length === 0) return undefined;
    const known = characterKeyByDefinition.get(location);
    if (known) return known;
    if (section === "lightCones") missingLightConeCharacter = true;
    else missingRelicCharacter = true;
    return undefined;
  };

  const lightConeKeys = await makeInstanceKeys(
    "light-cone",
    parsed.light_cones.map((record) => ({
      sourceIdentity: record._uid,
      visibleIdentity: {
        id: record.id,
        level: record.level,
        ascension: record.ascension,
        superimposition: record.superimposition,
      },
    })),
    sourceKind
  );
  const lightCones = parsed.light_cones.map((record, index) => {
    const definition = lightConeById.get(record.id);
    if (!definition) throw new Error(`Unknown v4 Light Cone: ${record.id}`);
    const key = lightConeKeys[index];
    if (!key) throw new Error("Missing normalized v4 Light Cone identity");
    const equippedCharacterKey = resolveLocation(record.location, "lightCones");
    const lightCone = {
      key,
      definitionId: definition.id,
      pathId: definition.path_id,
      level: record.level,
      ascension: record.ascension,
      superimposition: record.superimposition,
      locked: record.lock ?? null,
      ...(equippedCharacterKey ? { equippedCharacterKey } : {}),
    };
    if (equippedCharacterKey) {
      const character = characterByKey.get(equippedCharacterKey);
      if (character) {
        if (character.lightConeKey) {
          throw new Error(
            `Multiple Light Cones equipped to ${record.location}`
          );
        }
        character.lightConeKey = key;
      }
    }
    return lightCone;
  });

  const relicKeys = await makeInstanceKeys(
    "relic",
    parsed.relics.map((record) => ({
      sourceIdentity: record._uid,
      visibleIdentity: {
        setId: record.set_id,
        slot: resolveSlot(record.slot),
        rarity: record.rarity,
        level: record.level,
        mainStat: record.mainstat,
        substats: record.substats
          .map(({ key, value }) => ({ key, value }))
          .sort(
            (left, right) =>
              left.key.localeCompare(right.key) || left.value - right.value
          ),
      },
    })),
    sourceKind
  );
  const relics: Relic[] = parsed.relics.map((record, index) => {
    const slot = resolveSlot(record.slot);
    const mainPropertyId = resolveMainPropertyId(
      record.mainstat,
      slot,
      propertyById
    );
    const piece = findRelicPiece(record, slot, mainPropertyId, catalog);
    const substats = record.substats.map((substat) => ({
      statId: resolvePropertyId(
        substat.key,
        SUBSTAT_ALIASES,
        propertyById,
        "Relic substat"
      ),
      value: substat.value,
    }));
    const key = relicKeys[index];
    if (!key) throw new Error("Missing normalized v4 Relic identity");
    const equippedCharacterKey = resolveLocation(record.location, "relics");
    const relic: Relic = {
      key,
      definitionId: piece.id,
      setId: piece.set_id,
      slot,
      rarity: piece.rarity,
      level: record.level,
      mainStat: {
        statId: mainPropertyId,
        value: mainStatValue(piece, mainPropertyId, record.level, catalog),
      },
      substats,
      locked: record.lock ?? null,
      discarded: record.discard ?? null,
      ...(equippedCharacterKey ? { equippedCharacterKey } : {}),
    };
    if (equippedCharacterKey) {
      characterByKey.get(equippedCharacterKey)?.relicKeys.push(key);
    }
    return relic;
  });

  const coverage = parsed.coverage ? { ...parsed.coverage } : unknownCoverage();
  if (missingLightConeCharacter) {
    coverage.lightCones = "unknown";
  }
  if (missingRelicCharacter) {
    coverage.relics = "unknown";
  }
  const warnings: string[] = [];
  if (!parsed.coverage) warnings.push(SCANNER_WARNING_V4_COVERAGE_UNKNOWN);
  if (Object.values(coverage).some((value) => value !== "complete")) {
    warnings.push("SCANNER_PARTIAL_COVERAGE");
  }
  if (
    parsed.relics.some(
      (relic) =>
        (relic.preview_substats?.length ?? 0) > 0 ||
        (relic.reroll_substats?.length ?? 0) > 0
    )
  ) {
    warnings.push(SCANNER_WARNING_V4_PREVIEW_STATS_OMITTED);
  }
  if (missingLightConeCharacter || missingRelicCharacter) {
    warnings.push(SCANNER_WARNING_V4_EQUIPPED_CHARACTER_MISSING);
  }
  if (
    parsed.characters.some(
      (character) => !character.skills || !character.traces
    )
  ) {
    warnings.push(SCANNER_WARNING_V4_TRACES_PARTIAL);
  }
  if (
    parsed.light_cones.some((lightCone) => lightCone.lock == null) ||
    parsed.relics.some((relic) => relic.lock == null)
  ) {
    warnings.push("SCANNER_LOCK_STATE_PARTIAL");
  }
  if (parsed.relics.some((relic) => relic.discard == null)) {
    warnings.push("SCANNER_DISCARD_STATE_PARTIAL");
  }

  const uid = parsed.metadata.uid ? String(parsed.metadata.uid) : undefined;
  const account: AccountSnapshot = AccountSnapshotSchema.parse({
    schemaVersion: 3,
    profileId: `scanner:v4:${sourceKind}`,
    ...(uid ? { uid } : {}),
    characters,
    lightCones,
    relics,
    source: {
      provider: "scanner-export",
      formatVersion: 4,
      sourceVersion: `${sourceKind}-v4`,
      sourceRevision: parsed.build,
      importedAt: now.toISOString(),
      coverage,
      warnings: [...new Set(warnings)],
    },
  });
  return { account, warnings: account.source.warnings };
}
