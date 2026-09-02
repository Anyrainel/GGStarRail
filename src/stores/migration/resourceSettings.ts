import {
  DEFAULT_PERSISTED_RESOURCE_SETTINGS,
  type PersistedResourceSettings,
  PersistedResourceSettingsSchema,
} from "../resourceSettingsSchemas";

export const RESOURCE_SETTINGS_STORE_VERSION = 1;

export function migrateResourceSettings(
  persistedState: unknown,
  persistedVersion: number
): PersistedResourceSettings {
  if (persistedVersion !== RESOURCE_SETTINGS_STORE_VERSION) {
    return structuredClone(DEFAULT_PERSISTED_RESOURCE_SETTINGS);
  }
  const parsed = PersistedResourceSettingsSchema.safeParse(persistedState);
  return parsed.success
    ? parsed.data
    : structuredClone(DEFAULT_PERSISTED_RESOURCE_SETTINGS);
}
