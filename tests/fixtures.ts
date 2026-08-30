import type { AccountSnapshot, Relic } from "@/domain/account/schemas";

export function makeRelic(overrides: Partial<Relic> = {}): Relic {
  return {
    key: "relic:1",
    definitionId: "relic-definition:1",
    setId: "relic-set:1",
    slot: "head",
    rarity: 5,
    level: 15,
    mainStat: { statId: "hp", value: 705 },
    substats: [
      { statId: "crit-rate", value: 3.2 },
      { statId: "crit-dmg", value: 6.4 },
    ],
    locked: false,
    ...overrides,
  };
}

export function makeAccountSnapshot(): AccountSnapshot {
  return {
    schemaVersion: 1,
    profileId: "profile:local",
    uid: "600000001",
    region: "prod_official_usa",
    nickname: "Trailblazer",
    trailblazeLevel: 70,
    characters: [
      {
        key: "character:1",
        definitionId: "character:trailblazer",
        pathId: "remembrance",
        combatTypeId: "ice",
        level: 80,
        ascension: 6,
        eidolon: 6,
        traces: { skill: 10 },
        relicKeys: ["relic:1"],
      },
    ],
    lightCones: [
      {
        key: "light-cone:1",
        definitionId: "light-cone:sample",
        pathId: "remembrance",
        level: 80,
        ascension: 6,
        superimposition: 1,
        locked: true,
        equippedCharacterKey: "character:1",
      },
    ],
    relics: [makeRelic({ equippedCharacterKey: "character:1" })],
    source: {
      provider: "scanner-export",
      formatVersion: 1,
      sourceVersion: "0.1.0",
      importedAt: "2026-08-30T00:00:00.000Z",
      warnings: [],
    },
  };
}
