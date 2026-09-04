import { z } from "zod";
import {
  AccountSnapshotSchema,
  type Character,
  type LightCone,
  type Relic,
  type RelicSlot,
} from "@/domain/account/schemas";
import { assertNoSensitiveFields } from "@/lib/security";
import {
  accountCharacterKey,
  accountLightConeKey,
  accountProfileKey,
  accountRelicKey,
  accountRelicSlot,
  accountStatValue,
  starRailServerForUid,
} from "@/providers/accountNormalization";
import type { AccountImportCatalog } from "@/providers/importCatalog";
import type { AccountImportDraft } from "@/providers/types";

const IntegerLikeSchema = z.union([
  z.number().int(),
  z.string().regex(/^\d+$/).transform(Number),
]);

const EnkaSubAffixSchema = z
  .object({
    affixId: IntegerLikeSchema,
    cnt: z.number().int().positive(),
    step: z.number().int().nonnegative().optional().default(0),
  })
  .passthrough();

const EnkaRelicSchema = z
  .object({
    tid: IntegerLikeSchema,
    type: z.number().int().min(1).max(6),
    level: z.number().int().min(0).max(15),
    mainAffixId: IntegerLikeSchema,
    subAffixList: z.array(EnkaSubAffixSchema).max(4).default([]),
  })
  .passthrough();

const EnkaEquipmentSchema = z
  .object({
    tid: IntegerLikeSchema,
    level: z.number().int().min(1).max(100),
    promotion: z.number().int().min(0).max(8),
    rank: z.number().int().min(1).max(5),
  })
  .passthrough();

const EnkaSkillTreeSchema = z
  .object({
    pointId: IntegerLikeSchema,
    level: z.number().int().nonnegative(),
  })
  .passthrough();

const EnkaAvatarSchema = z
  .object({
    avatarId: IntegerLikeSchema,
    level: z.number().int().min(1).max(100),
    promotion: z.number().int().min(0).max(8),
    rank: z.number().int().min(0).max(6),
    skillTreeList: z.array(EnkaSkillTreeSchema).default([]),
    equipment: EnkaEquipmentSchema.nullish(),
    relicList: z.array(EnkaRelicSchema).default([]),
  })
  .passthrough();

const EnkaDetailInfoSchema = z
  .object({
    uid: IntegerLikeSchema.optional(),
    nickname: z.string().min(1).max(64).optional(),
    level: z.number().int().min(1).max(100).optional(),
    isDisplayAvatar: z.boolean().optional(),
    avatarDetailList: z.array(EnkaAvatarSchema).default([]),
  })
  .passthrough();

export const EnkaHsrShowcaseResponseSchema = z
  .object({
    detailInfo: EnkaDetailInfoSchema.optional().default({
      avatarDetailList: [],
    }),
    ttl: z.number().int().nonnegative(),
    uid: IntegerLikeSchema,
    region: z.string().min(1).max(32).optional(),
  })
  .passthrough();

export type EnkaHsrShowcaseResponse = z.infer<
  typeof EnkaHsrShowcaseResponseSchema
>;

export const UID_WARNING_SHOWCASE_ONLY = "UID_SHOWCASE_ONLY";
export const UID_WARNING_LOCK_STATE_UNAVAILABLE = "UID_LOCK_STATE_UNAVAILABLE";
export const UID_WARNING_DISCARD_STATE_UNAVAILABLE =
  "UID_DISCARD_STATE_UNAVAILABLE";
export const UID_WARNING_EMPTY_SHOWCASE = "UID_SHOWCASE_EMPTY";
export const UID_WARNING_UNKNOWN_CHARACTER = "UID_UNKNOWN_CHARACTER";
export const UID_WARNING_UNKNOWN_LIGHT_CONE = "UID_UNKNOWN_LIGHT_CONE";
export const UID_WARNING_UNKNOWN_RELIC = "UID_UNKNOWN_RELIC";
export const UID_WARNING_UNKNOWN_AFFIX = "UID_UNKNOWN_AFFIX";
export const UID_WARNING_RELIC_SLOT_MISMATCH = "UID_RELIC_SLOT_MISMATCH";
export const UID_WARNING_DUPLICATE_RELIC_SLOT = "UID_DUPLICATE_RELIC_SLOT";
export const UID_WARNING_DUPLICATE_SUBSTAT = "UID_DUPLICATE_SUBSTAT";
export const UID_WARNING_SUBSTAT_MAIN_COLLISION = "UID_SUBSTAT_MAIN_COLLISION";

const ENKA_SLOT_TO_ACCOUNT: Readonly<Record<number, RelicSlot>> = {
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

function avatarCompleteness(avatar: z.infer<typeof EnkaAvatarSchema>): number {
  return (
    avatar.relicList.length * 10 +
    avatar.skillTreeList.length +
    (avatar.equipment ? 5 : 0)
  );
}

function uniqueAvatars(
  avatars: readonly z.infer<typeof EnkaAvatarSchema>[]
): z.infer<typeof EnkaAvatarSchema>[] {
  const selected = new Map<number, z.infer<typeof EnkaAvatarSchema>>();
  for (const avatar of avatars) {
    const current = selected.get(avatar.avatarId);
    if (!current || avatarCompleteness(avatar) > avatarCompleteness(current)) {
      selected.set(avatar.avatarId, avatar);
    }
  }
  return [...selected.values()];
}

function normalizeRelic(
  record: z.infer<typeof EnkaRelicSchema>,
  uid: string,
  characterId: string,
  catalog: AccountImportCatalog,
  warnings: Set<string>
): Relic | null {
  const definition = catalog.relicPieces.get(String(record.tid));
  if (!definition) {
    warnings.add(warning(UID_WARNING_UNKNOWN_RELIC, record.tid));
    return null;
  }

  const slot = accountRelicSlot(definition.slot);
  if (ENKA_SLOT_TO_ACCOUNT[record.type] !== slot) {
    warnings.add(warning(UID_WARNING_RELIC_SLOT_MISMATCH, record.tid));
    return null;
  }

  const mainAffix = catalog.progression.relic_main_affixes.find(
    (affix) =>
      affix.group_id === definition.main_affix_group &&
      affix.affix_id === record.mainAffixId
  );
  const mainProperty = mainAffix
    ? catalog.properties.get(mainAffix.property_id)
    : undefined;
  const mainValue = mainAffix?.level_values[record.level];
  if (!mainAffix || !mainProperty || mainValue === undefined) {
    warnings.add(
      warning(
        UID_WARNING_UNKNOWN_AFFIX,
        `${definition.id}:main:${record.mainAffixId}`
      )
    );
    return null;
  }

  const seenSubstats = new Set<string>();
  const substats = record.subAffixList.flatMap((subAffix) => {
    const definitionAffix = catalog.progression.relic_sub_affixes.find(
      (affix) =>
        affix.group_id === definition.sub_affix_group &&
        affix.affix_id === subAffix.affixId
    );
    const property = definitionAffix
      ? catalog.properties.get(definitionAffix.property_id)
      : undefined;
    if (!definitionAffix || !property) {
      warnings.add(
        warning(
          UID_WARNING_UNKNOWN_AFFIX,
          `${definition.id}:sub:${subAffix.affixId}`
        )
      );
      return [];
    }
    if (property.id === mainProperty.id) {
      warnings.add(
        warning(
          UID_WARNING_SUBSTAT_MAIN_COLLISION,
          `${definition.id}:${property.id}`
        )
      );
      return [];
    }
    if (seenSubstats.has(property.id)) {
      warnings.add(
        warning(
          UID_WARNING_DUPLICATE_SUBSTAT,
          `${definition.id}:${property.id}`
        )
      );
      return [];
    }
    seenSubstats.add(property.id);
    const value =
      definitionAffix.base_value * subAffix.cnt +
      definitionAffix.step_value * subAffix.step;
    return [{ statId: property.id, value: accountStatValue(property, value) }];
  });

  return {
    key: accountRelicKey(uid, characterId, slot),
    definitionId: definition.id,
    setId: definition.set_id,
    slot,
    rarity: definition.rarity,
    level: record.level,
    mainStat: {
      statId: mainProperty.id,
      value: accountStatValue(mainProperty, mainValue),
    },
    substats,
    locked: null,
    discarded: null,
    equippedCharacterKey: accountCharacterKey(uid, characterId),
  };
}

export function normalizeEnkaHsrShowcase(
  input: unknown,
  catalog: AccountImportCatalog,
  now = new Date(),
  expectedUid?: string
): AccountImportDraft {
  assertNoSensitiveFields(input);
  const result = EnkaHsrShowcaseResponseSchema.safeParse(input);
  if (!result.success) throw new Error("UID_IMPORT_INVALID_RESPONSE");

  const parsed = result.data;
  const uid = String(parsed.uid);
  const expectedServer = starRailServerForUid(uid);
  const detailUid = parsed.detailInfo.uid
    ? String(parsed.detailInfo.uid)
    : undefined;
  if (
    expectedServer === null ||
    (expectedUid !== undefined && uid !== expectedUid) ||
    (detailUid !== undefined && detailUid !== uid) ||
    (parsed.region !== undefined && parsed.region !== expectedServer)
  ) {
    throw new Error("UID_IMPORT_IDENTITY_MISMATCH");
  }

  const warnings = new Set<string>([
    UID_WARNING_SHOWCASE_ONLY,
    UID_WARNING_LOCK_STATE_UNAVAILABLE,
    UID_WARNING_DISCARD_STATE_UNAVAILABLE,
  ]);
  const characters: Character[] = [];
  const lightCones: LightCone[] = [];
  const relics: Relic[] = [];

  const avatars = uniqueAvatars(parsed.detailInfo.avatarDetailList);
  if (avatars.length === 0 || parsed.detailInfo.isDisplayAvatar === false) {
    warnings.add(UID_WARNING_EMPTY_SHOWCASE);
  }

  for (const avatar of avatars) {
    const characterId = String(avatar.avatarId);
    const definition = catalog.characters.get(characterId);
    if (!definition) {
      warnings.add(warning(UID_WARNING_UNKNOWN_CHARACTER, characterId));
      continue;
    }

    const characterKey = accountCharacterKey(uid, characterId);
    const character: Character = {
      key: characterKey,
      definitionId: definition.id,
      pathId: definition.path_id,
      combatTypeId: definition.combat_type_id,
      level: avatar.level,
      ascension: avatar.promotion,
      eidolon: avatar.rank,
      traces: Object.fromEntries(
        avatar.skillTreeList.map((trace) => [
          String(trace.pointId),
          trace.level,
        ])
      ),
      relicKeys: [],
    };

    if (avatar.equipment) {
      const lightConeDefinition = catalog.lightCones.get(
        String(avatar.equipment.tid)
      );
      if (!lightConeDefinition) {
        warnings.add(
          warning(UID_WARNING_UNKNOWN_LIGHT_CONE, avatar.equipment.tid)
        );
      } else {
        const key = accountLightConeKey(uid, characterId);
        lightCones.push({
          key,
          definitionId: lightConeDefinition.id,
          pathId: lightConeDefinition.path_id,
          level: avatar.equipment.level,
          ascension: avatar.equipment.promotion,
          superimposition: avatar.equipment.rank,
          locked: null,
          equippedCharacterKey: characterKey,
        });
        character.lightConeKey = key;
      }
    }

    const relicBySlot = new Map<RelicSlot, Relic>();
    for (const record of avatar.relicList) {
      const relic = normalizeRelic(record, uid, characterId, catalog, warnings);
      if (!relic) continue;
      if (relicBySlot.has(relic.slot)) {
        warnings.add(
          warning(
            UID_WARNING_DUPLICATE_RELIC_SLOT,
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
    schemaVersion: 3,
    profileId: accountProfileKey(uid),
    uid,
    region: parsed.region ?? expectedServer ?? undefined,
    nickname: parsed.detailInfo.nickname,
    trailblazeLevel: parsed.detailInfo.level,
    characters,
    lightCones,
    relics,
    source: {
      provider: "uid-showcase",
      formatVersion: 1,
      sourceVersion: "enka-hsr-showcase-v1",
      sourceRevision: `gilore-ref:${catalog.manifest.source.revision}`,
      importedAt: now.toISOString(),
      coverage: {
        characters: "showcase-only",
        lightCones: "showcase-only",
        relics: "showcase-only",
      },
      warnings: warningList,
    },
  });

  return { account, warnings: warningList };
}
