import { z } from "zod";

export const StableIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const ImportCoverageSchema = z.enum([
  "complete",
  "equipped-only",
  "showcase-only",
  "unknown",
]);

export const ImportReceiptSchema = z
  .object({
    provider: z.enum([
      "scanner-export",
      "uid-showcase",
      "hoyolab-account",
      "demo-account",
    ]),
    formatVersion: z.number().int().positive(),
    sourceVersion: z.string().min(1),
    sourceRevision: z.string().min(1).optional(),
    importedAt: z.string().datetime(),
    coverage: z
      .object({
        characters: ImportCoverageSchema,
        lightCones: ImportCoverageSchema,
        relics: ImportCoverageSchema,
      })
      .strict(),
    warnings: z.array(StableIdSchema).default([]),
  })
  .strict();

export const AchievementIdSchema = z.number().int().positive().max(0xffff_ffff);

export const AchievementCaptureRevisionSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);

export const CompletedAchievementIdsSchema = z
  .array(AchievementIdSchema)
  .superRefine((ids, context) => {
    for (let index = 1; index < ids.length; index += 1) {
      const previous = ids[index - 1];
      const current = ids[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        current <= previous
      ) {
        context.addIssue({
          code: "custom",
          message: "Completed achievement IDs must be unique and sorted",
          path: [index],
        });
      }
    }
  });

export const AchievementCompletionSchema = z
  .object({
    completedIds: CompletedAchievementIdsSchema,
    capture: z
      .object({
        coverage: z.literal("complete"),
        source: z
          .object({
            kind: z.literal("packetCapture"),
            revision: AchievementCaptureRevisionSchema,
          })
          .strict(),
        importedAt: z.string().datetime(),
      })
      .strict()
      .optional(),
    locallyModifiedAt: z.string().datetime().optional(),
  })
  .strict();

export const CharacterSchema = z
  .object({
    key: StableIdSchema,
    definitionId: StableIdSchema,
    pathId: StableIdSchema,
    combatTypeId: StableIdSchema,
    level: z.number().int().min(1).max(100),
    ascension: z.number().int().min(0).max(8),
    eidolon: z.number().int().min(0).max(6),
    traces: z.record(StableIdSchema, z.number().int().nonnegative()),
    lightConeKey: StableIdSchema.optional(),
    relicKeys: z.array(StableIdSchema),
  })
  .strict();

export const LightConeSchema = z
  .object({
    key: StableIdSchema,
    definitionId: StableIdSchema,
    pathId: StableIdSchema,
    level: z.number().int().min(1).max(100),
    ascension: z.number().int().min(0).max(8),
    superimposition: z.number().int().min(1).max(5),
    /** Null means the source could not observe the in-game lock state. */
    locked: z.boolean().nullable(),
    equippedCharacterKey: StableIdSchema.optional(),
  })
  .strict();

export const RelicSlotSchema = z.enum([
  "head",
  "hands",
  "body",
  "feet",
  "planarSphere",
  "linkRope",
]);

export const RelicCategorySchema = z.enum(["cavern", "planar"]);

export const RelicStatSchema = z
  .object({
    statId: StableIdSchema,
    /** Ratio properties are stored as display percentage points (6.4 = 6.4%). */
    value: z.number().finite(),
  })
  .strict();

const RelicBaseSchema = z
  .object({
    key: StableIdSchema,
    definitionId: StableIdSchema,
    setId: StableIdSchema,
    slot: RelicSlotSchema,
    rarity: z.number().int().min(1).max(5),
    level: z.number().int().min(0).max(15),
    mainStat: RelicStatSchema,
    substats: z
      .array(RelicStatSchema)
      .max(4)
      .superRefine((substats, context) => {
        const seen = new Set<string>();
        substats.forEach((stat, index) => {
          if (seen.has(stat.statId)) {
            context.addIssue({
              code: "custom",
              message: "A Relic cannot contain the same substat twice",
              path: [index, "statId"],
            });
          }
          seen.add(stat.statId);
        });
      }),
    /** Null means the source could not observe the in-game lock state. */
    locked: z.boolean().nullable(),
    /** Null means the source could not observe the in-game discard mark. */
    discarded: z.boolean().nullable(),
    equippedCharacterKey: StableIdSchema.optional(),
  })
  .strict();

function rejectMainStatCollision(
  relic: {
    mainStat: { statId: string };
    substats: readonly { statId: string }[];
  },
  context: z.RefinementCtx
): void {
  const collisionIndex = relic.substats.findIndex(
    (stat) => stat.statId === relic.mainStat.statId
  );
  if (collisionIndex >= 0) {
    context.addIssue({
      code: "custom",
      message: "A Relic main stat cannot also appear as a substat",
      path: ["substats", collisionIndex, "statId"],
    });
  }
}

export const RelicSchema = RelicBaseSchema.superRefine(rejectMainStatCollision);

type AccountEquipmentIntegrity = {
  characters: z.infer<typeof CharacterSchema>[];
  lightCones: z.infer<typeof LightConeSchema>[];
  relics: z.infer<typeof RelicSchema>[];
};

function indexUniqueInstanceKeys(
  records: readonly { key: string }[],
  collection: "characters" | "lightCones" | "relics",
  label: "Character" | "Light Cone" | "Relic",
  context: z.RefinementCtx
): Map<string, number> {
  const indexByKey = new Map<string, number>();
  records.forEach((record, index) => {
    if (indexByKey.has(record.key)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate ${label} instance key: ${record.key}`,
        path: [collection, index, "key"],
      });
      return;
    }
    indexByKey.set(record.key, index);
  });
  return indexByKey;
}

function validateAccountEquipmentIntegrity(
  account: AccountEquipmentIntegrity,
  context: z.RefinementCtx
): void {
  const characterIndexByKey = indexUniqueInstanceKeys(
    account.characters,
    "characters",
    "Character",
    context
  );
  const lightConeIndexByKey = indexUniqueInstanceKeys(
    account.lightCones,
    "lightCones",
    "Light Cone",
    context
  );
  const relicIndexByKey = indexUniqueInstanceKeys(
    account.relics,
    "relics",
    "Relic",
    context
  );

  account.characters.forEach((character, characterIndex) => {
    if (character.lightConeKey) {
      const lightConeIndex = lightConeIndexByKey.get(character.lightConeKey);
      if (lightConeIndex === undefined) {
        context.addIssue({
          code: "custom",
          message: `Character Light Cone reference does not exist: ${character.lightConeKey}`,
          path: ["characters", characterIndex, "lightConeKey"],
        });
      } else if (
        account.lightCones[lightConeIndex]?.equippedCharacterKey !==
        character.key
      ) {
        context.addIssue({
          code: "custom",
          message: "Character and Light Cone equipment references must agree",
          path: ["characters", characterIndex, "lightConeKey"],
        });
      }
    }

    const seenRelicKeys = new Set<string>();
    character.relicKeys.forEach((relicKey, relicKeyIndex) => {
      if (seenRelicKeys.has(relicKey)) {
        context.addIssue({
          code: "custom",
          message: `Character Relic reference is duplicated: ${relicKey}`,
          path: ["characters", characterIndex, "relicKeys", relicKeyIndex],
        });
        return;
      }
      seenRelicKeys.add(relicKey);
      const relicIndex = relicIndexByKey.get(relicKey);
      if (relicIndex === undefined) {
        context.addIssue({
          code: "custom",
          message: `Character Relic reference does not exist: ${relicKey}`,
          path: ["characters", characterIndex, "relicKeys", relicKeyIndex],
        });
      } else if (
        account.relics[relicIndex]?.equippedCharacterKey !== character.key
      ) {
        context.addIssue({
          code: "custom",
          message: "Character and Relic equipment references must agree",
          path: ["characters", characterIndex, "relicKeys", relicKeyIndex],
        });
      }
    });
  });

  const lightConeIndexByCharacter = new Map<string, number>();
  account.lightCones.forEach((lightCone, lightConeIndex) => {
    const characterKey = lightCone.equippedCharacterKey;
    if (!characterKey) return;
    const characterIndex = characterIndexByKey.get(characterKey);
    if (characterIndex === undefined) {
      context.addIssue({
        code: "custom",
        message: `Light Cone equipped Character reference does not exist: ${characterKey}`,
        path: ["lightCones", lightConeIndex, "equippedCharacterKey"],
      });
      return;
    }
    const previousLightConeIndex = lightConeIndexByCharacter.get(characterKey);
    if (previousLightConeIndex !== undefined) {
      context.addIssue({
        code: "custom",
        message: "A Character cannot equip more than one Light Cone",
        path: ["lightCones", lightConeIndex, "equippedCharacterKey"],
      });
    } else {
      lightConeIndexByCharacter.set(characterKey, lightConeIndex);
    }
    if (account.characters[characterIndex]?.lightConeKey !== lightCone.key) {
      context.addIssue({
        code: "custom",
        message: "Light Cone and Character equipment references must agree",
        path: ["lightCones", lightConeIndex, "equippedCharacterKey"],
      });
    }
  });

  const relicIndexByCharacterSlot = new Map<string, number>();
  account.relics.forEach((relic, relicIndex) => {
    const characterKey = relic.equippedCharacterKey;
    if (!characterKey) return;
    const characterIndex = characterIndexByKey.get(characterKey);
    if (characterIndex === undefined) {
      context.addIssue({
        code: "custom",
        message: `Relic equipped Character reference does not exist: ${characterKey}`,
        path: ["relics", relicIndex, "equippedCharacterKey"],
      });
      return;
    }
    const characterSlotKey = `${characterKey}\u0000${relic.slot}`;
    const previousRelicIndex = relicIndexByCharacterSlot.get(characterSlotKey);
    if (previousRelicIndex !== undefined) {
      context.addIssue({
        code: "custom",
        message: `A Character cannot equip more than one Relic in slot ${relic.slot}`,
        path: ["relics", relicIndex, "equippedCharacterKey"],
      });
    } else {
      relicIndexByCharacterSlot.set(characterSlotKey, relicIndex);
    }
    if (!account.characters[characterIndex]?.relicKeys.includes(relic.key)) {
      context.addIssue({
        code: "custom",
        message: "Relic and Character equipment references must agree",
        path: ["relics", relicIndex, "equippedCharacterKey"],
      });
    }
  });
}

const AccountSnapshotFields = {
  profileId: StableIdSchema,
  uid: z
    .string()
    .regex(/^\d{8,12}$/)
    .optional(),
  region: z.string().min(1).max(32).optional(),
  nickname: z.string().min(1).max(64).optional(),
  trailblazeLevel: z.number().int().min(1).max(100).optional(),
  characters: z.array(CharacterSchema),
  lightCones: z.array(LightConeSchema),
  relics: z.array(RelicSchema),
  source: ImportReceiptSchema,
} as const;

/** Canonical account shape before achievement completion was added. */
export const AccountSnapshotV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    ...AccountSnapshotFields,
  })
  .strict()
  .superRefine(validateAccountEquipmentIntegrity);

export const AccountSnapshotSchema = z
  .object({
    schemaVersion: z.literal(3),
    ...AccountSnapshotFields,
    achievementCompletion: AchievementCompletionSchema.optional(),
  })
  .strict()
  .superRefine(validateAccountEquipmentIntegrity);

/** Canonical account shape used by the foundation before build-management work. */
export const AccountSnapshotV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    profileId: StableIdSchema,
    uid: z
      .string()
      .regex(/^\d{8,12}$/)
      .optional(),
    region: z.string().min(1).max(32).optional(),
    nickname: z.string().min(1).max(64).optional(),
    trailblazeLevel: z.number().int().min(1).max(100).optional(),
    characters: z.array(CharacterSchema),
    lightCones: z.array(LightConeSchema.extend({ locked: z.boolean() })),
    relics: z.array(
      RelicBaseSchema.omit({ discarded: true })
        .extend({ locked: z.boolean() })
        .superRefine(rejectMainStatCollision)
    ),
    source: z
      .object({
        provider: z.enum(["scanner-export", "hoyolab-account", "demo-account"]),
        formatVersion: z.number().int().positive(),
        sourceVersion: z.string().min(1),
        sourceRevision: z.string().min(1).optional(),
        importedAt: z.string().datetime(),
        warnings: z.array(z.string()).default([]),
      })
      .strict(),
  })
  .strict();

export type Character = z.infer<typeof CharacterSchema>;
export type LightCone = z.infer<typeof LightConeSchema>;
export type Relic = z.infer<typeof RelicSchema>;
export type RelicSlot = z.infer<typeof RelicSlotSchema>;
export type RelicCategory = z.infer<typeof RelicCategorySchema>;
export type AccountSnapshot = z.infer<typeof AccountSnapshotSchema>;
export type AccountSnapshotV2 = z.infer<typeof AccountSnapshotV2Schema>;
export type AchievementCompletion = z.infer<typeof AchievementCompletionSchema>;
export type ImportCoverage = z.infer<typeof ImportCoverageSchema>;

function uniqueByInstanceKey<T extends { key: string }>(
  records: readonly T[]
): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.key)) return false;
    seen.add(record.key);
    return true;
  });
}

function normalizeLegacyEquipment(
  input: z.infer<typeof AccountSnapshotV1Schema>
): Pick<AccountSnapshot, "characters" | "lightCones" | "relics"> {
  const characters: Character[] = uniqueByInstanceKey(input.characters).map(
    ({
      lightConeKey: _legacyLightCone,
      relicKeys: _legacyRelics,
      ...character
    }) => ({
      ...character,
      relicKeys: [],
    })
  );
  const characterByKey = new Map(
    characters.map((character) => [character.key, character])
  );
  const equippedLightConeCharacters = new Set<string>();
  const lightCones: LightCone[] = uniqueByInstanceKey(input.lightCones).map(
    (lightCone) => {
      const characterKey = lightCone.equippedCharacterKey;
      const character = characterKey
        ? characterByKey.get(characterKey)
        : undefined;
      if (!character || equippedLightConeCharacters.has(character.key)) {
        const { equippedCharacterKey: _invalidReference, ...unequipped } =
          lightCone;
        return unequipped;
      }
      equippedLightConeCharacters.add(character.key);
      character.lightConeKey = lightCone.key;
      return lightCone;
    }
  );
  const equippedRelicSlots = new Set<string>();
  const relics: Relic[] = uniqueByInstanceKey(input.relics).map((relic) => {
    const characterKey = relic.equippedCharacterKey;
    const character = characterKey
      ? characterByKey.get(characterKey)
      : undefined;
    const characterSlot = character
      ? `${character.key}\u0000${relic.slot}`
      : null;
    const canEquip =
      character !== undefined &&
      characterSlot !== null &&
      !equippedRelicSlots.has(characterSlot);
    if (!canEquip) {
      const { equippedCharacterKey: _invalidReference, ...unequipped } = relic;
      return { ...unequipped, discarded: null };
    }
    equippedRelicSlots.add(characterSlot);
    character.relicKeys.push(relic.key);
    return { ...relic, discarded: null };
  });
  return { characters, lightCones, relics };
}

export function migrateAccountSnapshotV1(
  input: z.infer<typeof AccountSnapshotV1Schema>
): AccountSnapshot {
  const equipment = normalizeLegacyEquipment(input);
  return AccountSnapshotSchema.parse({
    ...input,
    schemaVersion: 3,
    ...equipment,
    source: {
      ...input.source,
      coverage:
        input.source.provider === "demo-account"
          ? {
              characters: "complete",
              lightCones: "complete",
              relics: "complete",
            }
          : {
              characters: "unknown",
              lightCones: "unknown",
              relics: "unknown",
            },
      warnings: input.source.warnings.filter(
        (warning) => StableIdSchema.safeParse(warning).success
      ),
    },
  });
}

export function migrateAccountSnapshotV2(
  input: AccountSnapshotV2
): AccountSnapshot {
  return AccountSnapshotSchema.parse({
    ...input,
    schemaVersion: 3,
  });
}

export function relicCategory(slot: RelicSlot): RelicCategory {
  return slot === "planarSphere" || slot === "linkRope" ? "planar" : "cavern";
}
