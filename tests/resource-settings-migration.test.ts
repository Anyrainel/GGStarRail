import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import {
  DEFAULT_RESOURCE_SETTINGS,
  ResourceSettingsSchema,
} from "@/domain/resources/schemas";
import {
  migrateResourceSettings,
  RESOURCE_SETTINGS_STORE_VERSION,
} from "@/stores/migration/resourceSettings";
import { useResourceSettingsStore } from "@/stores/useResourceSettingsStore";

afterEach(() => {
  localStorage.removeItem(STORAGE_KEYS.resourceSettings);
  useResourceSettingsStore.getState().resetSettings();
});

describe("resource settings persistence", () => {
  it("hydrates the current version through the public persisted store", async () => {
    const settings = {
      enabledActions: {
        "level-up": false,
        synthesize: true,
        reroll: false,
      },
      minimumScoreGap: {
        "level-up": 12,
        synthesize: 24,
        reroll: 36,
      },
    };
    localStorage.setItem(
      STORAGE_KEYS.resourceSettings,
      JSON.stringify({
        state: { schemaVersion: 1, settings },
        version: RESOURCE_SETTINGS_STORE_VERSION,
      })
    );

    await useResourceSettingsStore.persist.rehydrate();

    expect(useResourceSettingsStore.getState().settings).toEqual(settings);
  });

  it("resets unknown or malformed persisted versions safely", () => {
    expect(
      migrateResourceSettings(
        {
          schemaVersion: 1,
          settings: {
            ...DEFAULT_RESOURCE_SETTINGS,
            minimumScoreGap: {
              ...DEFAULT_RESOURCE_SETTINGS.minimumScoreGap,
              reroll: 18,
            },
          },
        },
        0
      ).settings
    ).toEqual(DEFAULT_RESOURCE_SETTINGS);
    expect(migrateResourceSettings({ bad: true }, 1).settings).toEqual(
      DEFAULT_RESOURCE_SETTINGS
    );
  });

  it("rejects out-of-range score gaps instead of persisting bad meaning", () => {
    expect(
      ResourceSettingsSchema.safeParse({
        ...DEFAULT_RESOURCE_SETTINGS,
        minimumScoreGap: {
          ...DEFAULT_RESOURCE_SETTINGS.minimumScoreGap,
          synthesize: 101,
        },
      }).success
    ).toBe(false);
  });
});
