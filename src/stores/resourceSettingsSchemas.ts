import { z } from "zod";
import {
  DEFAULT_RESOURCE_SETTINGS,
  ResourceSettingsSchema,
} from "@/domain/resources/schemas";

export const PersistedResourceSettingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    settings: ResourceSettingsSchema,
  })
  .strict();

export type PersistedResourceSettings = z.infer<
  typeof PersistedResourceSettingsSchema
>;

export const DEFAULT_PERSISTED_RESOURCE_SETTINGS: PersistedResourceSettings = {
  schemaVersion: 1,
  settings: structuredClone(DEFAULT_RESOURCE_SETTINGS),
};
