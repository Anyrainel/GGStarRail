import { z } from "zod";
import {
  AccountSnapshotSchema,
  type Character,
  type LightCone,
  type Relic,
  type RelicSlot,
  StableIdSchema,
} from "@/domain/account/schemas";
import { assertNoSensitiveFields } from "@/lib/security";
import {
  accountCharacterKey,
  accountLightConeKey,
  accountProfileKey,
  accountRelicKey,
  accountRelicSlot,
  inferPromotion,
  starRailServerForUid,
} from "@/providers/accountNormalization";
import type { AccountImportCatalog } from "@/providers/importCatalog";
import type { AccountImportDraft } from "@/providers/types";

const HoYoLabPropertySchema = z
  .object({
    property_type: z.number().int().positive(),
    value: z.string().min(1),
    times: z.number().int().nonnegative().optional(),
    is_preview: z.boolean().optional().default(false),
  })
  .passthrough();

const HoYoLabRelicSchema = z
  .object({
    id: z.number().int().positive(),
    level: z.number().int().min(0).max(15),
    pos: z.number().int().min(1).max(6),
    rarity: z.number().int().min(1).max(5),
    main_property: HoYoLabPropertySchema,
    properties: z.array(HoYoLabPropertySchema).max(4).default([]),
  })
  .passthrough();

const HoYoLabEquipmentSchema = z
  .object({
    id: z.number().int().positive(),
    level: z.number().int().min(1).max(100),
    rank: z.number().int().min(1).max(5),
    rarity: z.number().int().min(1).max(5),
  })
  .passthrough();

const HoYoLabSkillSchema = z
  .object({
    point_id: z.union([z.string().min(1), z.number().int().positive()]),
    level: z.number().int().nonnegative(),
  })
  .passthrough();

const HoYoLabAvatarSchema = z
  .object({
    id: z.number().int().positive(),
    level: z.number().int().min(1).max(100),
    rank: z.number().int().min(0).max(6),
    equip: HoYoLabEquipmentSchema.nullish(),
    relics: z.array(HoYoLabRelicSchema).default([]),
    ornaments: z.array(HoYoLabRelicSchema).default([]),
    skills: z.array(HoYoLabSkillSchema).default([]),
  })
  .passthrough();

export const HoYoLabAvatarInfoResponseSchema = z
  .object({
    retcode: z.number().int(),
    message: z.string().optional(),
    data: z
      .object({
        avatar_list: z.array(HoYoLabAvatarSchema).default([]),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

export type HoYoLabAvatarInfoResponse = z.infer<
  typeof HoYoLabAvatarInfoResponseSchema
>;

const HoYoLabProxyEnvelopeSchema = z
  .object({
    source: z
      .object({
        kind: z.literal("hoyolab-hkrpg-avatar-info"),
        region: z.enum(["os", "cn"]),
        transport: z.enum(["global-primary", "cn-primary"]),
      })
      .strict(),
    data: z.unknown(),
  })
  .strict();

export type HoYoLabRegion = "os" | "cn";

export const HOYOLAB_WARNING_EQUIPPED_ONLY = "HOYOLAB_EQUIPPED_ONLY";
export const HOYOLAB_WARNING_LOCK_STATE_UNAVAILABLE =
  "HOYOLAB_LOCK_STATE_UNAVAILABLE";
export const HOYOLAB_WARNING_DISCARD_STATE_UNAVAILABLE =
  "HOYOLAB_DISCARD_STATE_UNAVAILABLE";
export const HOYOLAB_WARNING_ASCENSION_INFERRED = "HOYOLAB_ASCENSION_INFERRED";
export const HOYOLAB_WARNING_PREVIEW_SUBSTATS_OMITTED =
  "HOYOLAB_PREVIEW_SUBSTATS_OMITTED";
export const HOYOLAB_WARNING_EMPTY_ACCOUNT = "HOYOLAB_ACCOUNT_EMPTY";
export const HOYOLAB_WARNING_UNKNOWN_CHARACTER = "HOYOLAB_UNKNOWN_CHARACTER";
export const HOYOLAB_WARNING_UNKNOWN_LIGHT_CONE = "HOYOLAB_UNKNOWN_LIGHT_CONE";
export const HOYOLAB_WARNING_UNKNOWN_RELIC = "HOYOLAB_UNKNOWN_RELIC";
export const HOYOLAB_WARNING_UNKNOWN_PROPERTY = "HOYOLAB_UNKNOWN_PROPERTY";
export const HOYOLAB_WARNING_RELIC_SLOT_MISMATCH =
  "HOYOLAB_RELIC_SLOT_MISMATCH";
export const HOYOLAB_WARNING_DUPLICATE_RELIC_SLOT =
  "HOYOLAB_DUPLICATE_RELIC_SLOT";
export const HOYOLAB_WARNING_DUPLICATE_SUBSTAT = "HOYOLAB_DUPLICATE_SUBSTAT";
export const HOYOLAB_WARNING_SUBSTAT_MAIN_COLLISION =
  "HOYOLAB_SUBSTAT_MAIN_COLLISION";
export const HOYOLAB_WARNING_AUTH_LIVE_UNVERIFIED =
  "HOYOLAB_AUTH_LIVE_UNVERIFIED";

const PROPERTY_TYPE_TO_ID: Readonly<Record<number, string>> = {
  27: "HPDelta",
  32: "HPAddedRatio",
  29: "AttackDelta",
  33: "AttackAddedRatio",
  31: "DefenceDelta",
  34: "DefenceAddedRatio",
  51: "SpeedDelta",
  52: "CriticalChanceBase",
  53: "CriticalDamageBase",
  56: "StatusProbabilityBase",
  57: "StatusResistanceBase",
  59: "BreakDamageAddedRatioBase",
  54: "SPRatioBase",
  55: "HealRatioBase",
  12: "PhysicalAddedRatio",
  14: "FireAddedRatio",
  16: "IceAddedRatio",
  18: "ThunderAddedRatio",
  20: "WindAddedRatio",
  22: "QuantumAddedRatio",
  24: "ImaginaryAddedRatio",
};

const HOYOLAB_SLOT_TO_ACCOUNT: Readonly<Record<number, RelicSlot>> = {
  1: "head",
  2: "hands",
  3: "body",
  4: "feet",
  5: "planarSphere",
  6: "linkRope",
};

function warning(code: string, id: number | string): string {
  return `${code}:${id}`;
}

function parseProperty(
  property: z.infer<typeof HoYoLabPropertySchema>,
  catalog: AccountImportCatalog,
  warnings: Set<string>,
  context: string
): { statId: string; value: number } | null {
  const statId = PROPERTY_TYPE_TO_ID[property.property_type];
  if (!statId || !catalog.properties.has(statId)) {
    warnings.add(
      warning(
        HOYOLAB_WARNING_UNKNOWN_PROPERTY,
        `${context}:${property.property_type}`
      )
    );
    return null;
  }
  const value = Number.parseFloat(property.value.replace(/%$/, ""));
  if (!Number.isFinite(value)) {
    warnings.add(
      warning(
        HOYOLAB_WARNING_UNKNOWN_PROPERTY,
        `${context}:${property.property_type}`
      )
    );
    return null;
  }
  return { statId, value: Number(value.toFixed(3)) };
}

function normalizeRelic(
  record: z.infer<typeof HoYoLabRelicSchema>,
  uid: string,
  characterId: string,
  catalog: AccountImportCatalog,
  warnings: Set<string>
): Relic | null {
  const definition = catalog.relicPieces.get(String(record.id));
  if (!definition) {
    warnings.add(warning(HOYOLAB_WARNING_UNKNOWN_RELIC, record.id));
    return null;
  }
  const slot = accountRelicSlot(definition.slot);
  if (HOYOLAB_SLOT_TO_ACCOUNT[record.pos] !== slot) {
    warnings.add(warning(HOYOLAB_WARNING_RELIC_SLOT_MISMATCH, record.id));
    return null;
  }
  const mainStat = parseProperty(
    record.main_property,
    catalog,
    warnings,
    `${record.id}:main`
  );
  if (!mainStat) return null;

  const seen = new Set<string>();
  const substats = record.properties.flatMap((property) => {
    if (property.is_preview) {
      warnings.add(HOYOLAB_WARNING_PREVIEW_SUBSTATS_OMITTED);
      return [];
    }
    const stat = parseProperty(property, catalog, warnings, `${record.id}:sub`);
    if (!stat) {
      return [];
    }
    if (stat.statId === mainStat.statId) {
      warnings.add(
        warning(
          HOYOLAB_WARNING_SUBSTAT_MAIN_COLLISION,
          `${record.id}:${stat.statId}`
        )
      );
      return [];
    }
    if (seen.has(stat.statId)) {
      warnings.add(
        warning(
          HOYOLAB_WARNING_DUPLICATE_SUBSTAT,
          `${record.id}:${stat.statId}`
        )
      );
      return [];
    }
    seen.add(stat.statId);
    return [stat];
  });

  return {
    key: accountRelicKey(uid, characterId, slot),
    definitionId: definition.id,
    setId: definition.set_id,
    slot,
    rarity: definition.rarity,
    level: record.level,
    mainStat,
    substats,
    locked: null,
    discarded: null,
    equippedCharacterKey: accountCharacterKey(uid, characterId),
  };
}

export function normalizeHoYoLabAvatarInfo(
  input: unknown,
  request: { uid: string; region: HoYoLabRegion },
  catalog: AccountImportCatalog,
  now = new Date()
): AccountImportDraft {
  assertNoSensitiveFields(input);
  const envelope = HoYoLabProxyEnvelopeSchema.safeParse(input);
  if (envelope.success && envelope.data.source.region !== request.region) {
    throw new Error("HOYOLAB_IMPORT_REGION_MISMATCH");
  }
  const result = HoYoLabAvatarInfoResponseSchema.safeParse(
    envelope.success ? envelope.data.data : input
  );
  if (!result.success) throw new Error("HOYOLAB_IMPORT_INVALID_RESPONSE");
  if (result.data.retcode !== 0 || result.data.data === null) {
    throw new Error(`HOYOLAB_UPSTREAM_RETCODE_${result.data.retcode}`);
  }

  const server = starRailServerForUid(request.uid);
  const isCn = server === "prod_gf_cn" || server === "prod_qd_cn";
  if (!server || (request.region === "cn") !== isCn) {
    throw new Error("HOYOLAB_IMPORT_REGION_MISMATCH");
  }

  const warnings = new Set<string>([
    HOYOLAB_WARNING_EQUIPPED_ONLY,
    HOYOLAB_WARNING_LOCK_STATE_UNAVAILABLE,
    HOYOLAB_WARNING_DISCARD_STATE_UNAVAILABLE,
    HOYOLAB_WARNING_AUTH_LIVE_UNVERIFIED,
  ]);
  const characters: Character[] = [];
  const lightCones: LightCone[] = [];
  const relics: Relic[] = [];
  if (result.data.data.avatar_list.length === 0) {
    warnings.add(HOYOLAB_WARNING_EMPTY_ACCOUNT);
  }

  for (const avatar of result.data.data.avatar_list) {
    const characterId = String(avatar.id);
    const definition = catalog.characters.get(characterId);
    if (!definition) {
      warnings.add(warning(HOYOLAB_WARNING_UNKNOWN_CHARACTER, characterId));
      continue;
    }
    warnings.add(HOYOLAB_WARNING_ASCENSION_INFERRED);

    const characterKey = accountCharacterKey(request.uid, characterId);
    const traces = Object.fromEntries(
      avatar.skills.flatMap((skill) => {
        const key = String(skill.point_id);
        return StableIdSchema.safeParse(key).success
          ? [[key, skill.level] as const]
          : [];
      })
    );
    const character: Character = {
      key: characterKey,
      definitionId: definition.id,
      pathId: definition.path_id,
      combatTypeId: definition.combat_type_id,
      level: avatar.level,
      ascension: inferPromotion(avatar.level, definition.promotions),
      eidolon: avatar.rank,
      traces,
      relicKeys: [],
    };

    if (avatar.equip) {
      const lightConeDefinition = catalog.lightCones.get(
        String(avatar.equip.id)
      );
      if (!lightConeDefinition) {
        warnings.add(
          warning(HOYOLAB_WARNING_UNKNOWN_LIGHT_CONE, avatar.equip.id)
        );
      } else {
        const key = accountLightConeKey(request.uid, characterId);
        lightCones.push({
          key,
          definitionId: lightConeDefinition.id,
          pathId: lightConeDefinition.path_id,
          level: avatar.equip.level,
          ascension: inferPromotion(
            avatar.equip.level,
            lightConeDefinition.promotions
          ),
          superimposition: avatar.equip.rank,
          locked: null,
          equippedCharacterKey: characterKey,
        });
        character.lightConeKey = key;
      }
    }

    const relicBySlot = new Map<RelicSlot, Relic>();
    for (const record of [...avatar.relics, ...avatar.ornaments]) {
      const relic = normalizeRelic(
        record,
        request.uid,
        characterId,
        catalog,
        warnings
      );
      if (!relic) continue;
      if (relicBySlot.has(relic.slot)) {
        warnings.add(
          warning(
            HOYOLAB_WARNING_DUPLICATE_RELIC_SLOT,
            `${characterId}:${relic.slot}`
          )
        );
        continue;
      }
      relicBySlot.set(relic.slot, relic);
    }
    character.relicKeys.push(
      ...[...relicBySlot.values()].map(({ key }) => key)
    );
    relics.push(...relicBySlot.values());
    characters.push(character);
  }

  const warningList = [...warnings];
  const account = AccountSnapshotSchema.parse({
    schemaVersion: 2,
    profileId: accountProfileKey(request.uid),
    uid: request.uid,
    region: server,
    characters,
    lightCones,
    relics,
    source: {
      provider: "hoyolab-account",
      formatVersion: 1,
      sourceVersion: envelope.success
        ? `hoyolab-hkrpg-avatar-info-${envelope.data.source.transport}-v1`
        : `hoyolab-hkrpg-avatar-info-${request.region}-fixture-v1`,
      sourceRevision: `gilore-ref:${catalog.manifest.source.revision}`,
      importedAt: now.toISOString(),
      coverage: {
        characters: "complete",
        lightCones: "equipped-only",
        relics: "equipped-only",
      },
      warnings: warningList,
    },
  });

  return { account, warnings: warningList };
}
