import { z } from "zod";

export const LocalizedTextSchema = z
  .object({
    en: z.string().min(1),
    "zh-CN": z.string().min(1),
  })
  .strict();

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const SourceProvenanceSchema = z
  .object({
    repository: z.string().url(),
    revision: z.string().min(7),
    extractorVersion: z.string().min(1),
    generatedAt: z.string().datetime(),
    license: z.string().min(1),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const DatasetManifestEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.string().min(1),
    recordCount: z.number().int().nonnegative(),
    checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

export const DataBundleManifestSchema = z
  .object({
    format: z.literal("ggstarrail-data"),
    schemaVersion: z.literal(1),
    game: z.literal("honkai-star-rail"),
    provider: z.literal("gilore"),
    locales: z.tuple([z.literal("en"), z.literal("zh-CN")]),
    provenance: SourceProvenanceSchema,
    datasets: z.array(DatasetManifestEntrySchema).min(1),
  })
  .strict();

export type DataBundleManifest = z.infer<typeof DataBundleManifestSchema>;
