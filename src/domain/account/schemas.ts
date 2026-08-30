import { z } from "zod";

export const StableIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const ImportReceiptSchema = z
  .object({
    provider: z.enum(["scanner-export", "hoyolab-account"]),
    formatVersion: z.number().int().positive(),
    sourceVersion: z.string().min(1),
    sourceRevision: z.string().min(1).optional(),
    importedAt: z.string().datetime(),
    warnings: z.array(z.string()).default([]),
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
    locked: z.boolean(),
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
    value: z.number().finite(),
  })
  .strict();

export const RelicSchema = z
  .object({
    key: StableIdSchema,
    definitionId: StableIdSchema,
    setId: StableIdSchema,
    slot: RelicSlotSchema,
    rarity: z.number().int().min(1).max(5),
    level: z.number().int().min(0).max(15),
    mainStat: RelicStatSchema,
    substats: z.array(RelicStatSchema).max(5),
    locked: z.boolean(),
    equippedCharacterKey: StableIdSchema.optional(),
  })
  .strict();

export const AccountSnapshotSchema = z
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
    lightCones: z.array(LightConeSchema),
    relics: z.array(RelicSchema),
    source: ImportReceiptSchema,
  })
  .strict();

export type Character = z.infer<typeof CharacterSchema>;
export type LightCone = z.infer<typeof LightConeSchema>;
export type Relic = z.infer<typeof RelicSchema>;
export type RelicSlot = z.infer<typeof RelicSlotSchema>;
export type RelicCategory = z.infer<typeof RelicCategorySchema>;
export type AccountSnapshot = z.infer<typeof AccountSnapshotSchema>;

export function relicCategory(slot: RelicSlot): RelicCategory {
  return slot === "planarSphere" || slot === "linkRope" ? "planar" : "cavern";
}
