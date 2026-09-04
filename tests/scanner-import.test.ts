import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAccountImport } from "@/domain/account/merge";
import {
  type AccountSnapshot,
  AccountSnapshotSchema,
} from "@/domain/account/schemas";
import {
  createManagerInstructionEnvelope,
  ManagerInstructionEnvelopeSchema,
  summarizeManagerInstructionActionability,
} from "@/lib/managerInstructions";
import { loadAchievementIds } from "@/providers/gilore/catalog";
import {
  SCANNER_WARNING_V4_COVERAGE_UNKNOWN,
  SCANNER_WARNING_V4_EQUIPPED_CHARACTER_MISSING,
  SCANNER_WARNING_V4_PREVIEW_STATS_OMITTED,
} from "@/providers/scanner/interopV4";
import {
  parseVersionedScannerExport,
  SCANNER_WARNING_PARTIAL_COVERAGE,
  SCANNER_WARNING_REFERENCE_REVISION_MISMATCH,
  SCANNER_WARNING_SANITIZED_FIXTURE,
  SCANNER_WARNING_TRACES_NOT_INCLUDED,
  SCANNER_WARNING_UNKNOWN_DISCARD_STATE,
  SCANNER_WARNING_UNKNOWN_LOCK_STATE,
  SCANNER_WARNING_V1_COVERAGE_UNKNOWN,
} from "@/providers/scanner/schema";
import { makeAccountSnapshot } from "./fixtures";
import scannerAchievementV3Fixture from "./fixtures/goodscanner-hsr-achievement-only-v3.json";
import scannerV1Fixture from "./fixtures/goodscanner-hsr-experimental-v1.json";
import scannerV2Fixture from "./fixtures/goodscanner-hsr-experimental-v2.json";
import nativeScannerV1Fixture from "./fixtures/native-scanner-account-v1.json";
import hsrScannerV4Fixture from "./fixtures/scanner/hsr-scanner-v4.json";
import managerV1Fixture from "./fixtures/scanner/manager-instructions-v1.json";
import reliquaryV4Fixture from "./fixtures/scanner/reliquary-v4.json";

function productionScannerV3(
  entries: Array<{ achievementId: number; status: string }>
) {
  return {
    ...structuredClone(scannerV2Fixture),
    schema: "goodscanner.hsr",
    schemaVersion: 3,
    source: {
      ...scannerV2Fixture.source,
      kind: "packetCapture",
      coverage: {
        characters: "unknown",
        lightCones: "unknown",
        relics: "unknown",
      },
    },
    characters: [],
    lightCones: [],
    relics: [],
    planarOrnaments: [],
    achievements: {
      source: { kind: "packetCapture", revision: "auto-reliquary-1.2.0" },
      coverage: "complete",
      entries,
    },
  };
}

async function knownAchievementIds(count: number): Promise<number[]> {
  const ids = [...(await loadAchievementIds())].sort(
    (left, right) => left - right
  );
  if (ids.length < count) {
    throw new Error(
      `Generated achievement reference has fewer than ${count} IDs`
    );
  }
  return ids.slice(0, count);
}

function fixtureSha256(relativePath: string): string {
  const bytes = readFileSync(new URL(relativePath, import.meta.url));
  return createHash("sha256").update(bytes).digest("hex");
}

function semanticManagerKey(
  envelope: ReturnType<typeof ManagerInstructionEnvelopeSchema.parse>
): string {
  const payload = JSON.stringify({
    referenceRevision: envelope.reference.revision,
    instructions: envelope.instructions,
  });
  return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}

describe("GOODScanner HSR import compatibility", () => {
  it("parses the byte-exact scanner-produced achievement-only v3 golden", async () => {
    expect(
      fixtureSha256("./fixtures/goodscanner-hsr-achievement-only-v3.json")
    ).toBe("9c9bcfc5f35af71385f1c2e4c8d6d71308d6927a82af5a44c1bb593959175dc1");

    const parsed = await parseVersionedScannerExport(
      scannerAchievementV3Fixture,
      new Date("2026-09-04T06:00:00.000Z")
    );

    expect(parsed.account.achievementCompletion).toEqual({
      completedIds: [4010101, 4040201],
      capture: {
        coverage: "complete",
        source: {
          kind: "packetCapture",
          revision: "auto-reliquary-1.2.0",
        },
        importedAt: "2026-09-04T06:00:00.000Z",
      },
    });
    expect(parsed.account.source).toMatchObject({
      provider: "scanner-export",
      sourceVersion: "goodscanner-hsr-v3",
      coverage: {
        characters: "unknown",
        lightCones: "unknown",
        relics: "unknown",
      },
    });
  });

  it("parses the byte-exact scanner-produced v2 golden", async () => {
    expect(
      fixtureSha256("./fixtures/goodscanner-hsr-experimental-v2.json")
    ).toBe("3734ff182b1e7d6511a00262457ed9e219a103c7f9a1e1baaf0f596d90a2d373");

    const parsed = await parseVersionedScannerExport(scannerV2Fixture);
    expect(parsed.account).toMatchObject({
      schemaVersion: 3,
      source: {
        sourceVersion: "goodscanner-hsr-experimental-v2",
      },
    });
  });

  it("imports an achievement-only production v3 capture without clearing unknown inventory sections", async () => {
    const [knownAchievementId] = await knownAchievementIds(1);
    const draft = await parseVersionedScannerExport(
      productionScannerV3([]),
      new Date("2026-09-04T04:00:00.000Z")
    );
    const current = makeAccountSnapshot();
    current.achievementCompletion = {
      completedIds: [knownAchievementId!],
    };
    const merged = applyAccountImport(current, draft.account, "merge");

    expect(draft.account).toMatchObject({
      schemaVersion: 3,
      characters: [],
      lightCones: [],
      relics: [],
      achievementCompletion: {
        completedIds: [],
        capture: {
          coverage: "complete",
          source: {
            kind: "packetCapture",
            revision: "auto-reliquary-1.2.0",
          },
          importedAt: "2026-09-04T04:00:00.000Z",
        },
      },
      source: {
        sourceVersion: "goodscanner-hsr-v3",
        coverage: {
          characters: "unknown",
          lightCones: "unknown",
          relics: "unknown",
        },
      },
    });
    expect(merged.characters).toEqual(current.characters);
    expect(merged.lightCones).toEqual(current.lightCones);
    expect(merged.relics).toEqual(current.relics);
    expect(merged.achievementCompletion).toEqual(
      draft.account.achievementCompletion
    );
  });

  it("imports sorted unique production v3 IDs from the generated achievement reference", async () => {
    const [firstAchievementId, secondAchievementId] =
      await knownAchievementIds(2);

    const draft = await parseVersionedScannerExport(
      productionScannerV3([
        { achievementId: firstAchievementId!, status: "completed" },
        { achievementId: secondAchievementId!, status: "completed" },
      ]),
      new Date("2026-09-04T05:00:00.000Z")
    );

    expect(draft.account.achievementCompletion).toEqual({
      completedIds: [firstAchievementId, secondAchievementId],
      capture: {
        coverage: "complete",
        source: {
          kind: "packetCapture",
          revision: "auto-reliquary-1.2.0",
        },
        importedAt: "2026-09-04T05:00:00.000Z",
      },
    });
  });

  it("preserves existing completion when production v3 omits achievement evidence", async () => {
    const [knownAchievementId] = await knownAchievementIds(1);
    const input = productionScannerV3([]);
    delete (input as { achievements?: unknown }).achievements;

    const draft = await parseVersionedScannerExport(input);
    const current = makeAccountSnapshot();
    current.achievementCompletion = {
      completedIds: [knownAchievementId!],
    };
    const merged = applyAccountImport(current, draft.account, "merge");

    expect(draft.account.achievementCompletion).toBeUndefined();
    expect(merged.characters).toEqual(current.characters);
    expect(merged.lightCones).toEqual(current.lightCones);
    expect(merged.relics).toEqual(current.relics);
    expect(merged.achievementCompletion).toEqual(current.achievementCompletion);
  });

  it.each([
    ["experimental schema name", "goodscanner.hsr.experimental", 3],
    ["production schema with the old version", "goodscanner.hsr", 2],
    ["unknown production version", "goodscanner.hsr", 4],
    ["unknown schema name", "goodscanner.hsr.future", 3],
  ])("rejects production v3 with %s", async (_label, schema, schemaVersion) => {
    const input = productionScannerV3([]);
    Object.assign(input, { schema, schemaVersion });

    await expect(parseVersionedScannerExport(input)).rejects.toThrow();
  });

  it.each([
    "source",
    "reference",
    "privacy",
    "characters",
    "lightCones",
    "relics",
    "planarOrnaments",
  ] as const)("rejects production v3 without required %s", async (field) => {
    const input = productionScannerV3([]);
    delete (input as unknown as Record<string, unknown>)[field];

    await expect(parseVersionedScannerExport(input)).rejects.toThrow();
  });

  it("rejects fields outside the full production v3 envelope", async () => {
    const unexpectedTopLevel = productionScannerV3([]);
    Object.assign(unexpectedTopLevel, { unexpected: true });
    await expect(
      parseVersionedScannerExport(unexpectedTopLevel)
    ).rejects.toThrow();

    const achievementCoverageInInventorySource = productionScannerV3([]);
    Object.assign(achievementCoverageInInventorySource.source.coverage, {
      achievements: "complete",
    });
    await expect(
      parseVersionedScannerExport(achievementCoverageInInventorySource)
    ).rejects.toThrow();
  });

  it("distinguishes an omitted achievement snapshot from JSON null", async () => {
    const input = productionScannerV3([]);
    (input as { achievements: unknown }).achievements = null;

    await expect(parseVersionedScannerExport(input)).rejects.toThrow();
  });

  it.each([
    "source",
    "coverage",
    "entries",
  ] as const)("rejects achievement evidence without required %s", async (field) => {
    const input = productionScannerV3([]);
    delete (input.achievements as unknown as Record<string, unknown>)[field];

    await expect(parseVersionedScannerExport(input)).rejects.toThrow();
  });

  it.each([
    ["non-packet source", "source.kind", "screenCapture"],
    ["empty source revision", "source.revision", ""],
    ["overlong source revision", "source.revision", "x".repeat(129)],
    ["unsafe source revision", "source.revision", "capture account=secret"],
    ["non-ASCII source revision", "source.revision", "抓包-1"],
    ["unknown coverage", "coverage", "unknown"],
    ["unknown status", "entries.0.status", "finished"],
  ])("rejects production v3 achievement evidence with %s", async (_label, path, value) => {
    const input = productionScannerV3([
      { achievementId: 1, status: "completed" },
    ]);
    if (path === "source.kind") {
      input.achievements.source.kind = value;
    } else if (path === "source.revision") {
      input.achievements.source.revision = value;
    } else if (path === "coverage") {
      input.achievements.coverage = value;
    } else {
      input.achievements.entries[0]!.status = value;
    }

    await expect(parseVersionedScannerExport(input)).rejects.toThrow();
  });

  it("rejects raw numeric protocol status in production v3 entries", async () => {
    const input = productionScannerV3([
      { achievementId: 1, status: "completed" },
    ]);
    (input.achievements.entries[0] as { status: unknown }).status = 2;

    await expect(parseVersionedScannerExport(input)).rejects.toThrow();
  });

  it("rejects extra achievement source, snapshot, and entry fields", async () => {
    const unexpectedSourceField = productionScannerV3([]);
    Object.assign(unexpectedSourceField.achievements.source, {
      unexpected: true,
    });
    await expect(
      parseVersionedScannerExport(unexpectedSourceField)
    ).rejects.toThrow();

    const unexpectedSnapshotField = productionScannerV3([]);
    Object.assign(unexpectedSnapshotField.achievements, { observedAt: 1 });
    await expect(
      parseVersionedScannerExport(unexpectedSnapshotField)
    ).rejects.toThrow();

    const unexpectedEntryField = productionScannerV3([
      { achievementId: 1, status: "completed" },
    ]);
    Object.assign(unexpectedEntryField.achievements.entries[0]!, {
      progress: 1,
    });
    await expect(
      parseVersionedScannerExport(unexpectedEntryField)
    ).rejects.toThrow();
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["larger than u32", 0x1_0000_0000],
    ["string", "80001"],
  ])("rejects production v3 %s achievement IDs", async (_label, id) => {
    const input = productionScannerV3([
      { achievementId: 1, status: "completed" },
    ]);
    (
      input.achievements.entries[0] as { achievementId: unknown }
    ).achievementId = id;

    await expect(parseVersionedScannerExport(input)).rejects.toThrow();
  });

  it("rejects duplicate and unsorted production v3 completion entries", async () => {
    const [firstAchievementId, secondAchievementId] =
      await knownAchievementIds(2);
    await expect(
      parseVersionedScannerExport(
        productionScannerV3([
          { achievementId: firstAchievementId!, status: "completed" },
          { achievementId: firstAchievementId!, status: "completed" },
        ])
      )
    ).rejects.toThrow(/Duplicate completed achievement ID/);

    await expect(
      parseVersionedScannerExport(
        productionScannerV3([
          { achievementId: secondAchievementId!, status: "completed" },
          { achievementId: firstAchievementId!, status: "completed" },
        ])
      )
    ).rejects.toThrow(/sorted ascending/);
  });

  it("rejects production v3 IDs missing from the generated achievement reference", async () => {
    const achievementIds = await loadAchievementIds();
    let unknownAchievementId = 0xffff_ffff;
    while (achievementIds.has(unknownAchievementId)) {
      unknownAchievementId -= 1;
    }

    await expect(
      parseVersionedScannerExport(
        productionScannerV3([
          { achievementId: unknownAchievementId, status: "completed" },
        ])
      )
    ).rejects.toThrow(`Unknown HSR achievement: ${unknownAchievementId}`);
  });

  it("imports v1 conservatively and preserves observed tri-state fields", async () => {
    const draft = await parseVersionedScannerExport(
      scannerV1Fixture,
      new Date("2026-09-02T12:00:00.000Z")
    );

    expect(draft.account.schemaVersion).toBe(3);
    expect(draft.account.source.coverage).toEqual({
      characters: "unknown",
      lightCones: "unknown",
      relics: "unknown",
    });
    expect(draft.account.lightCones[0]?.locked).toBe(true);
    expect(draft.account.relics[1]?.mainStat).toEqual({
      statId: "AttackAddedRatio",
      value: 35.9424,
    });
    expect(draft.account.relics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "relic-001",
          locked: false,
          discarded: true,
        }),
        expect.objectContaining({
          key: "planar-001",
          locked: null,
          discarded: null,
        }),
      ])
    );
    expect(draft.warnings).toEqual([
      SCANNER_WARNING_TRACES_NOT_INCLUDED,
      SCANNER_WARNING_V1_COVERAGE_UNKNOWN,
      SCANNER_WARNING_SANITIZED_FIXTURE,
      SCANNER_WARNING_REFERENCE_REVISION_MISMATCH,
      SCANNER_WARNING_UNKNOWN_LOCK_STATE,
      SCANNER_WARNING_UNKNOWN_DISCARD_STATE,
    ]);
  });

  it("rejects materially wrong v1 main-stat display values", async () => {
    const materiallyWrong = structuredClone(scannerV1Fixture);
    materiallyWrong.planarOrnaments[0].mainStat.value = 38.8;

    await expect(parseVersionedScannerExport(materiallyWrong)).rejects.toThrow(
      /Relic main stat value 38\.8 does not match generated value 35\.9424 or UI value 35\.9/
    );
  });

  it("imports v2 screen capture without numeric stat IDs", async () => {
    const draft = await parseVersionedScannerExport(
      scannerV2Fixture,
      new Date("2026-09-02T12:00:00.000Z")
    );

    expect(draft.account).toMatchObject({
      schemaVersion: 3,
      profileId: "scanner:local",
      source: {
        provider: "scanner-export",
        formatVersion: 2,
        sourceVersion: "goodscanner-hsr-experimental-v2",
        importedAt: "2026-09-02T12:00:00.000Z",
        coverage: {
          characters: "complete",
          lightCones: "complete",
          relics: "complete",
        },
      },
    });
    expect(draft.account.relics[0]).toMatchObject({
      mainStat: { statId: "HPDelta", value: 705.6 },
      substats: [
        { statId: "CriticalChanceBase", value: 8.7 },
        { statId: "SpeedDelta", value: 5.1 },
      ],
      locked: false,
      discarded: true,
    });
    expect(draft.account.relics[1]).toMatchObject({
      mainStat: { statId: "AttackAddedRatio", value: 35.9424 },
      locked: null,
      discarded: null,
      equippedCharacterKey: "character-001",
    });
    expect(draft.warnings).toEqual([
      SCANNER_WARNING_TRACES_NOT_INCLUDED,
      SCANNER_WARNING_REFERENCE_REVISION_MISMATCH,
      SCANNER_WARNING_UNKNOWN_LOCK_STATE,
      SCANNER_WARNING_UNKNOWN_DISCARD_STATE,
    ]);
  });

  it("uses v2 stat keys and display values without coupling to translated display names", async () => {
    const translatedNameVariant = structuredClone(scannerV2Fixture);
    translatedNameVariant.planarOrnaments[0].mainStat.name = {
      zhCn: "攻击力百分比",
      en: "ATK Percentage",
    };

    const draft = await parseVersionedScannerExport(translatedNameVariant);

    expect(draft.account.relics[1]?.mainStat).toEqual({
      statId: "AttackAddedRatio",
      value: 35.9424,
    });
  });

  it("validates v2 main-stat values against generated display units", async () => {
    const uiRounded = structuredClone(scannerV2Fixture);
    uiRounded.planarOrnaments[0].mainStat.value = 35.9;
    await expect(parseVersionedScannerExport(uiRounded)).resolves.toMatchObject(
      {
        account: {
          relics: expect.arrayContaining([
            expect.objectContaining({
              mainStat: {
                statId: "AttackAddedRatio",
                value: 35.9,
              },
            }),
          ]),
        },
      }
    );

    const materiallyWrong = structuredClone(scannerV2Fixture);
    materiallyWrong.planarOrnaments[0].mainStat.value = 38.8;
    await expect(parseVersionedScannerExport(materiallyWrong)).rejects.toThrow(
      /Relic main stat value 38\.8 does not match generated value 35\.9424 or UI value 35\.9/
    );
  });

  it("accepts a visible one-decimal flat SPD main stat", async () => {
    const visibleSpeed = structuredClone(scannerV2Fixture);
    visibleSpeed.relics[0] = {
      ...visibleSpeed.relics[0]!,
      key: "61014",
      gameId: 61014,
      slot: "Feet",
      mainStat: {
        key: "SpeedDelta",
        name: { zhCn: "速度", en: "SPD" },
        value: 25,
      },
      substats: [visibleSpeed.relics[0]!.substats[0]!],
    };

    const draft = await parseVersionedScannerExport(visibleSpeed);

    expect(draft.account.relics[0]?.mainStat).toEqual({
      statId: "SpeedDelta",
      value: 25,
    });
  });

  it("canonicalizes a visually equivalent GOODScanner Relic definition", async () => {
    const capture = structuredClone(scannerV2Fixture);
    capture.relics[0] = {
      ...capture.relics[0]!,
      key: "55001",
      gameId: 55001,
      rarity: 4,
      slot: "Body",
      level: 12,
      mainStat: {
        key: "HealRatioBase",
        name: { zhCn: "治疗量加成", en: "Outgoing Healing Boost" },
        value: 23,
      },
      substats: [],
      locationKey: null,
    };

    const draft = await parseVersionedScannerExport(capture);

    expect(draft.account.relics[0]?.definitionId).toBe("51013");
    expect(draft.account.relics[0]?.setId).toBe("101");
  });

  it("preserves declared partial coverage and labels sanitized fixtures", async () => {
    const partial = structuredClone(scannerV2Fixture);
    partial.source.kind = "sanitizedFixture";
    partial.source.coverage.relics = "equipped-only";

    const draft = await parseVersionedScannerExport(partial);

    expect(draft.account.source.coverage).toEqual({
      characters: "complete",
      lightCones: "complete",
      relics: "equipped-only",
    });
    expect(draft.warnings).toEqual(
      expect.arrayContaining([
        SCANNER_WARNING_PARTIAL_COVERAGE,
        SCANNER_WARNING_SANITIZED_FIXTURE,
      ])
    );
  });

  it("accepts packet capture without treating it as a fixture or inventing coverage", async () => {
    const packetCapture = structuredClone(scannerV2Fixture);
    packetCapture.source.kind = "packetCapture";
    packetCapture.source.revision = "reliquary-archiver-v0.18.0-hsr-4.5";
    packetCapture.source.coverage.relics = "unknown";

    const draft = await parseVersionedScannerExport(packetCapture);

    expect(draft.account.source.coverage.relics).toBe("unknown");
    expect(draft.warnings).toContain(SCANNER_WARNING_PARTIAL_COVERAGE);
    expect(draft.warnings).not.toContain(SCANNER_WARNING_SANITIZED_FIXTURE);
  });

  it("accepts a compatible older reference revision with an explicit warning", async () => {
    const older = structuredClone(scannerV2Fixture);
    older.reference.revision = "0".repeat(40);

    const draft = await parseVersionedScannerExport(older);

    expect(draft.account.relics).toHaveLength(2);
    expect(draft.warnings).toContain(
      SCANNER_WARNING_REFERENCE_REVISION_MISMATCH
    );
  });

  it("still rejects unresolved IDs when the reference revision differs", async () => {
    const unknown = structuredClone(scannerV2Fixture);
    unknown.reference.revision = "0".repeat(40);
    unknown.relics[0].key = "999999";
    unknown.relics[0].gameId = 999999;

    await expect(parseVersionedScannerExport(unknown)).rejects.toThrow(
      /Unknown Relic piece/
    );
  });

  it("validates v2 provider, privacy, credential, and stat contracts", async () => {
    const wrongProvider = structuredClone(scannerV2Fixture);
    wrongProvider.reference.provider = "other-provider";
    await expect(parseVersionedScannerExport(wrongProvider)).rejects.toThrow();

    const unsafePrivacy = structuredClone(scannerV2Fixture);
    unsafePrivacy.privacy.serverItemIdentifiersIncluded = true;
    await expect(parseVersionedScannerExport(unsafePrivacy)).rejects.toThrow();

    const credentialShaped = structuredClone(scannerV2Fixture);
    Object.assign(credentialShaped.source, { cookie: "must-not-survive" });
    await expect(parseVersionedScannerExport(credentialShaped)).rejects.toThrow(
      /Sensitive field/
    );

    const numericStatId = structuredClone(scannerV2Fixture);
    Object.assign(numericStatId.relics[0].mainStat, { gameId: 1 });
    await expect(parseVersionedScannerExport(numericStatId)).rejects.toThrow();
  });

  it("rejects duplicate substats and a main stat repeated as a substat", async () => {
    const duplicate = structuredClone(scannerV2Fixture);
    duplicate.relics[0].substats.push({
      ...duplicate.relics[0].substats[0],
    });
    await expect(parseVersionedScannerExport(duplicate)).rejects.toThrow(
      /Duplicate Relic substat property/
    );

    const repeatedMain = structuredClone(scannerV2Fixture);
    repeatedMain.relics[0].substats[0].key =
      repeatedMain.relics[0].mainStat.key;
    await expect(parseVersionedScannerExport(repeatedMain)).rejects.toThrow(
      /cannot be both main and substat/
    );
  });

  it("rejects duplicate GOODScanner instances and slot occupancy before evaluation", async () => {
    const duplicateInstance = structuredClone(scannerV2Fixture);
    duplicateInstance.relics.push({ ...duplicateInstance.relics[0]! });
    await expect(
      parseVersionedScannerExport(duplicateInstance)
    ).rejects.toThrow(/Duplicate Relic local ID/);

    const duplicateSlot = structuredClone(scannerV2Fixture);
    duplicateSlot.planarOrnaments.push({
      ...duplicateSlot.planarOrnaments[0]!,
      localId: "planar-002",
    });
    await expect(parseVersionedScannerExport(duplicateSlot)).rejects.toThrow(
      /cannot equip more than one Relic in slot planarSphere/
    );
  });

  it("migrates a legacy native scanner account v1 through the public parser", async () => {
    const draft = await parseVersionedScannerExport(nativeScannerV1Fixture);

    expect(draft.account).toMatchObject({
      schemaVersion: 3,
      profileId: "scanner:legacy",
      source: {
        coverage: {
          characters: "unknown",
          lightCones: "unknown",
          relics: "unknown",
        },
        warnings: ["LEGACY_SCANNER_IMPORT"],
      },
      relics: [
        expect.objectContaining({
          key: "legacy-relic-001",
          locked: true,
          discarded: null,
        }),
      ],
    });
  });

  it("accepts native v3 completion IDs present in the generated achievement reference", async () => {
    const achievementIds = await loadAchievementIds();
    const knownAchievementId = achievementIds.values().next().value;
    if (knownAchievementId === undefined) {
      throw new Error("Generated achievement reference is empty");
    }
    const imported = await parseVersionedScannerExport(scannerV2Fixture);
    const native = {
      format: "ggstarrail-scanner-export",
      schemaVersion: 1,
      sourceApp: { name: "GGStarRail", version: "0.1.0" },
      exportedAt: "2026-09-04T04:00:00.000Z",
      account: {
        ...imported.account,
        achievementCompletion: { completedIds: [knownAchievementId] },
      },
    };

    await expect(parseVersionedScannerExport(native)).resolves.toMatchObject({
      account: {
        achievementCompletion: { completedIds: [knownAchievementId] },
      },
    });
  });

  it("rejects native v3 completion IDs missing from the generated achievement reference", async () => {
    const achievementIds = await loadAchievementIds();
    let unknownAchievementId = 0xffff_ffff;
    while (achievementIds.has(unknownAchievementId)) {
      unknownAchievementId -= 1;
    }
    const imported = await parseVersionedScannerExport(scannerV2Fixture);
    const native = {
      format: "ggstarrail-scanner-export",
      schemaVersion: 1,
      sourceApp: { name: "GGStarRail", version: "0.1.0" },
      exportedAt: "2026-09-04T04:00:00.000Z",
      account: {
        ...imported.account,
        achievementCompletion: { completedIds: [unknownAchievementId] },
      },
    };

    await expect(parseVersionedScannerExport(native)).rejects.toThrow(
      `Unknown HSR achievement: ${unknownAchievementId}`
    );
  });

  it("rejects unknown native Relic definitions through the public parser", async () => {
    const unknownPiece = structuredClone(nativeScannerV1Fixture);
    unknownPiece.account.relics[0]!.definitionId = "999999";

    await expect(parseVersionedScannerExport(unknownPiece)).rejects.toThrow(
      /Unknown Relic definition: 999999/
    );
  });

  it("rejects unknown and incompatible native Relic main stats", async () => {
    const unknownProperty = structuredClone(nativeScannerV1Fixture);
    unknownProperty.account.relics[0]!.mainStat.statId = "UnknownProperty";
    await expect(parseVersionedScannerExport(unknownProperty)).rejects.toThrow(
      /Unknown Relic property definition: UnknownProperty/
    );

    const incompatibleProperty = structuredClone(nativeScannerV1Fixture);
    incompatibleProperty.account.relics[0]!.mainStat.statId =
      "AttackAddedRatio";
    await expect(
      parseVersionedScannerExport(incompatibleProperty)
    ).rejects.toThrow(
      /Relic main stat AttackAddedRatio is incompatible with definition 61011/
    );
  });

  it("validates native character and Light Cone paths and progression", async () => {
    const imported = await parseVersionedScannerExport(scannerV2Fixture);
    const native = {
      format: "ggstarrail-scanner-export" as const,
      schemaVersion: 1 as const,
      sourceApp: { name: "GGStarRail Scanner", version: "0.2.0" },
      exportedAt: "2026-09-02T12:00:00.000Z",
      account: imported.account,
    };

    const wrongCharacterPath = structuredClone(native);
    wrongCharacterPath.account.characters[0]!.pathId = "Warrior";
    await expect(
      parseVersionedScannerExport(wrongCharacterPath)
    ).rejects.toThrow(/Character path Warrior does not match definition 1001/);

    const invalidLightConeLevel = structuredClone(native);
    invalidLightConeLevel.account.lightCones[0]!.level = 100;
    await expect(
      parseVersionedScannerExport(invalidLightConeLevel)
    ).rejects.toThrow(/Light Cone level 100 exceeds definition 23005/);
  });

  it("validates native Relic set, slot, rarity, and level", async () => {
    const wrongSet = structuredClone(nativeScannerV1Fixture);
    wrongSet.account.relics[0]!.setId = "102";
    await expect(parseVersionedScannerExport(wrongSet)).rejects.toThrow(
      /Relic set 102 does not match definition 61011/
    );

    const wrongSlot = structuredClone(nativeScannerV1Fixture);
    wrongSlot.account.relics[0]!.slot = "body";
    await expect(parseVersionedScannerExport(wrongSlot)).rejects.toThrow(
      /Relic slot body does not match definition 61011/
    );

    const wrongRarity = structuredClone(nativeScannerV1Fixture);
    wrongRarity.account.relics[0]!.rarity = 4;
    await expect(parseVersionedScannerExport(wrongRarity)).rejects.toThrow(
      /Relic rarity 4 does not match definition 61011/
    );

    const overleveled = structuredClone(nativeScannerV1Fixture);
    overleveled.account.relics[0]!.definitionId = "51011";
    overleveled.account.relics[0]!.rarity = 4;
    await expect(parseVersionedScannerExport(overleveled)).rejects.toThrow(
      /Relic level 15 exceeds definition 51011 maximum 12/
    );
  });

  it("parses the compiled Rust manager golden and reproduces its semantic SHA-256", () => {
    expect(
      fixtureSha256("./fixtures/scanner/manager-instructions-v1.json")
    ).toBe("ae7302fdd6a017c8d92ecadc6b82ecb9e82c54520ea41781309adfc69df67570");

    const envelope = ManagerInstructionEnvelopeSchema.parse(managerV1Fixture);
    expect(semanticManagerKey(envelope)).toBe(
      "sha256:0525633c88fcce130bdedf285db6ac865f8654654b40e069d1aa86a5f21917ce"
    );
    expect(semanticManagerKey(envelope)).toBe(envelope.idempotencyKey);
  });

  it("keeps unsafe manager instructions preview-only", () => {
    const baseline = ManagerInstructionEnvelopeSchema.parse(managerV1Fixture);
    const original = baseline.instructions[0]!;
    const ambiguousMatcher = { ...original.matcher, level: 12 };
    const envelope = ManagerInstructionEnvelopeSchema.parse({
      ...baseline,
      instructions: [
        { ...original, id: "actionable" },
        {
          ...original,
          id: "unknown-before",
          matcher: { ...original.matcher, level: 14 },
          before: { lock: false, discard: null },
        },
        {
          ...original,
          id: "equipped",
          matcher: {
            ...original.matcher,
            level: 13,
            locationKey: "1001",
          },
        },
        {
          ...original,
          id: "locked-discard",
          matcher: { ...original.matcher, level: 11 },
          before: { lock: true, discard: false },
          desired: { discard: true },
        },
        {
          ...original,
          id: "ambiguous-a",
          matcher: ambiguousMatcher,
        },
        {
          ...original,
          id: "ambiguous-b",
          matcher: ambiguousMatcher,
        },
      ],
    });

    const summary = summarizeManagerInstructionActionability(envelope);

    expect(summary).toMatchObject({
      actionableCount: 1,
      previewOnlyCount: 5,
      reasonCounts: {
        "unknown-before": 1,
        equipped: 1,
        locked: 1,
        "ambiguous-matcher": 2,
      },
    });
    expect(summary.instructions).toEqual([
      { instructionId: "actionable", actionable: true, reasons: [] },
      {
        instructionId: "unknown-before",
        actionable: false,
        reasons: ["unknown-before"],
      },
      {
        instructionId: "equipped",
        actionable: false,
        reasons: ["equipped"],
      },
      {
        instructionId: "locked-discard",
        actionable: false,
        reasons: ["locked"],
      },
      {
        instructionId: "ambiguous-a",
        actionable: false,
        reasons: ["ambiguous-matcher"],
      },
      {
        instructionId: "ambiguous-b",
        actionable: false,
        reasons: ["ambiguous-matcher"],
      },
    ]);
  });

  it.each([
    ["whitespace", "invalid instruction"],
    ["non-ASCII", "指令"],
    ["more than 128 characters", "a".repeat(129)],
  ])("rejects a manager instruction ID containing %s", (_label, id) => {
    const baseline = ManagerInstructionEnvelopeSchema.parse(managerV1Fixture);
    const invalid = {
      ...baseline,
      instructions: [{ ...baseline.instructions[0]!, id }],
    };

    expect(ManagerInstructionEnvelopeSchema.safeParse(invalid).success).toBe(
      false
    );
  });
});

describe("interoperable HSR scanner v4 imports", () => {
  it("canonicalizes the known Passerby Body visible-equivalence pair", async () => {
    const capture = structuredClone(hsrScannerV4Fixture);
    capture.characters = [];
    capture.light_cones = [];
    capture.relics = [
      {
        set_id: "101",
        name: "Passerby of Wandering Cloud",
        slot: "Body",
        rarity: 4,
        level: 12,
        mainstat: "Outgoing Healing Boost",
        substats: [],
        preview_substats: [],
        location: "",
        lock: false,
        discard: false,
        _uid: "screen-order-ambiguous-body",
      },
    ];

    const draft = await parseVersionedScannerExport(capture);

    expect(draft.account.relics[0]).toMatchObject({
      definitionId: "51013",
      setId: "101",
      slot: "body",
      rarity: 4,
      mainStat: { statId: "HealRatioBase" },
    });
  });

  it("maps all six HSR slots and reconstructs main values from generated affixes", async () => {
    const relic = (
      setId: string,
      slot: string,
      mainstat: string,
      index: number
    ) => ({
      set_id: setId,
      name: "Fixture set",
      slot,
      rarity: 5,
      level: 15,
      mainstat,
      substats: [],
      location: "",
      lock: false,
      discard: false,
      _uid: `scan-order-${index}`,
    });
    const fixture: unknown = {
      source: "HSR-Scanner",
      build: "v1.5.0",
      version: 4,
      metadata: {},
      light_cones: [],
      relics: [
        relic("101", "Head", "HP", 1),
        relic("101", "Hands", "ATK", 2),
        relic("101", "Body", "CRIT Rate", 3),
        relic("101", "Feet", "SPD", 4),
        relic("301", "Planar Sphere", "Ice DMG Boost", 5),
        relic("301", "Link Rope", "Break Effect", 6),
      ],
      characters: [],
    };

    const draft = await parseVersionedScannerExport(fixture);

    expect(
      draft.account.relics.map((entry) => ({
        definitionId: entry.definitionId,
        slot: entry.slot,
        mainStat: entry.mainStat,
      }))
    ).toEqual([
      {
        definitionId: "61011",
        slot: "head",
        mainStat: { statId: "HPDelta", value: 705.6 },
      },
      {
        definitionId: "61012",
        slot: "hands",
        mainStat: { statId: "AttackDelta", value: 352.8 },
      },
      {
        definitionId: "61013",
        slot: "body",
        mainStat: { statId: "CriticalChanceBase", value: 32.4 },
      },
      {
        definitionId: "61014",
        slot: "feet",
        mainStat: { statId: "SpeedDelta", value: 25.032 },
      },
      {
        definitionId: "63015",
        slot: "planarSphere",
        mainStat: { statId: "IceAddedRatio", value: 38.88 },
      },
      {
        definitionId: "63016",
        slot: "linkRope",
        mainStat: {
          statId: "BreakDamageAddedRatioBase",
          value: 64.8,
        },
      },
    ]);
  });

  it("normalizes HSR-Scanner data without trusting its scan-order _uid", async () => {
    const first = await parseVersionedScannerExport(
      hsrScannerV4Fixture,
      new Date("2026-09-02T12:00:00.000Z")
    );
    const rescanned = structuredClone(hsrScannerV4Fixture);
    rescanned.light_cones[0]._uid = "light_cone_1";
    rescanned.light_cones[0].lock = false;
    rescanned.light_cones[0].location = "";
    rescanned.relics[0]._uid = "relic_1";
    rescanned.relics[0].lock = false;
    rescanned.relics[0].discard = true;
    rescanned.relics[0].location = "";
    const second = await parseVersionedScannerExport(
      rescanned,
      new Date("2026-09-02T12:00:00.000Z")
    );

    expect(first.account).toMatchObject({
      schemaVersion: 3,
      profileId: "scanner:v4:hsr-scanner",
      uid: "601869216",
      source: {
        provider: "scanner-export",
        formatVersion: 4,
        sourceVersion: "hsr-scanner-v4",
        sourceRevision: "v1.5.0",
        coverage: {
          characters: "unknown",
          lightCones: "unknown",
          relics: "unknown",
        },
      },
    });
    expect(first.account.characters[0]).toMatchObject({
      key: "v4:character:1101",
      definitionId: "1101",
      pathId: "Shaman",
      traces: {
        "skill:basic": 6,
        "trace:ability_1": 1,
        "source:abilityVersion": 0,
      },
      lightConeKey: first.account.lightCones[0]?.key,
      relicKeys: [first.account.relics[0]?.key],
    });
    expect(first.account.lightCones[0]).toMatchObject({
      definitionId: "23005",
      equippedCharacterKey: "v4:character:1101",
      locked: true,
    });
    expect(first.account.relics[0]).toMatchObject({
      definitionId: "61022",
      setId: "102",
      slot: "hands",
      mainStat: { statId: "AttackDelta", value: 352.8 },
      substats: [
        { statId: "DefenceDelta", value: 16 },
        { statId: "DefenceAddedRatio", value: 5.4 },
        { statId: "CriticalChanceBase", value: 5.1 },
        { statId: "CriticalDamageBase", value: 31.7 },
      ],
      equippedCharacterKey: "v4:character:1101",
      locked: true,
      discarded: false,
    });
    expect(first.warnings).toEqual(
      expect.arrayContaining([
        SCANNER_WARNING_V4_COVERAGE_UNKNOWN,
        SCANNER_WARNING_PARTIAL_COVERAGE,
        SCANNER_WARNING_V4_PREVIEW_STATS_OMITTED,
      ])
    );
    expect(second.account.lightCones[0]?.key).toBe(
      first.account.lightCones[0]?.key
    );
    expect(second.account.relics[0]?.key).toBe(first.account.relics[0]?.key);
    expect(JSON.stringify(first.account)).not.toContain("light_cone_999");
    expect(JSON.stringify(first.account)).not.toContain("relic_999");
  });

  it("uses explicit Reliquary coverage and hashes packet instance IDs", async () => {
    const complete = await parseVersionedScannerExport(
      reliquaryV4Fixture,
      new Date("2026-09-02T12:00:00.000Z")
    );

    expect(complete.account.source.coverage).toEqual({
      characters: "complete",
      lightCones: "complete",
      relics: "complete",
    });
    expect(complete.account.source).toMatchObject({
      sourceVersion: "reliquary-v4",
      sourceRevision: "0.18.0",
    });
    expect(complete.account.relics[0]).toMatchObject({
      definitionId: "61011",
      mainStat: { statId: "HPDelta", value: 705.6 },
      substats: [
        { statId: "CriticalChanceBase", value: 8.7 },
        { statId: "SpeedDelta", value: 5.1 },
      ],
    });
    expect(JSON.stringify(complete.account)).not.toContain("3456789012");

    const envelope = await createManagerInstructionEnvelope(
      complete.account,
      [
        {
          relic: complete.account.relics[0]!,
          score: 50,
          grade: "S",
          matchingBuildIds: ["build:fixture"],
          result: { decision: "keep", reasons: ["keep-score"] },
        },
      ],
      "8cdb905dc2f8e6fffa9be4eb07af3e34435d6091",
      "ggstarrail-reliquary-fixture"
    );
    expect(JSON.stringify(envelope)).not.toContain("3456789012");
    expect(envelope.instructions[0]?.matcher.key).toBe("61011");
  });

  it("does not infer complete Reliquary coverage when the declaration is absent", async () => {
    const withoutCoverage = structuredClone(reliquaryV4Fixture);
    delete (withoutCoverage as Partial<typeof withoutCoverage>).coverage;

    const draft = await parseVersionedScannerExport(withoutCoverage);

    expect(draft.account.source.coverage).toEqual({
      characters: "unknown",
      lightCones: "unknown",
      relics: "unknown",
    });
    expect(draft.warnings).toContain(SCANNER_WARNING_V4_COVERAGE_UNKNOWN);
  });

  it("drops equipment backrefs when a partial v4 export omits the Character", async () => {
    const withoutCharacter = structuredClone(hsrScannerV4Fixture);
    withoutCharacter.characters = [];

    const draft = await parseVersionedScannerExport(withoutCharacter);

    expect(draft.account.characters).toEqual([]);
    expect(draft.account.lightCones[0]?.equippedCharacterKey).toBeUndefined();
    expect(draft.account.relics[0]?.equippedCharacterKey).toBeUndefined();
    expect(draft.account.source.coverage.lightCones).toBe("unknown");
    expect(draft.account.source.coverage.relics).toBe("unknown");
    expect(draft.warnings).toContain(
      SCANNER_WARNING_V4_EQUIPPED_CHARACTER_MISSING
    );
    expect(AccountSnapshotSchema.parse(draft.account)).toEqual(draft.account);
  });

  it.each([
    ["HSR-Scanner", "hsr-scanner-v4"],
    ["Kel-Z HSR Scanner", "kel-v4"],
    ["Fribbels HSR Optimizer", "fribbels-v4"],
    ["Reliquary Archiver", "reliquary-v4"],
  ])("recognizes the %s v4 source contract", async (source, sourceVersion) => {
    const fixture = structuredClone(hsrScannerV4Fixture);
    fixture.source = source;

    const draft = await parseVersionedScannerExport(fixture);

    expect(draft.account.source.sourceVersion).toBe(sourceVersion);
  });

  it("rejects transient device and server item identifiers", async () => {
    const withDeviceId = structuredClone(hsrScannerV4Fixture) as unknown as {
      metadata: Record<string, unknown>;
    };
    withDeviceId.metadata.device_id = "must-not-survive";
    await expect(parseVersionedScannerExport(withDeviceId)).rejects.toThrow(
      /Private identifier/
    );

    const withServerId = structuredClone(hsrScannerV4Fixture) as unknown as {
      relics: Record<string, unknown>[];
    };
    withServerId.relics[0]!.server_item_id = "must-not-survive";
    await expect(parseVersionedScannerExport(withServerId)).rejects.toThrow(
      /Private identifier/
    );
  });

  it("rejects duplicate v4 equipment for one Character before evaluation", async () => {
    const duplicateLightCone = structuredClone(hsrScannerV4Fixture);
    duplicateLightCone.light_cones.push({
      ...duplicateLightCone.light_cones[0]!,
      _uid: "light_cone_1000",
    });
    await expect(
      parseVersionedScannerExport(duplicateLightCone)
    ).rejects.toThrow(/Multiple Light Cones/);

    const duplicateSlot = structuredClone(hsrScannerV4Fixture);
    duplicateSlot.relics.push({
      ...duplicateSlot.relics[0]!,
      _uid: "relic_1000",
    });
    await expect(parseVersionedScannerExport(duplicateSlot)).rejects.toThrow(
      /cannot equip more than one Relic in slot hands/
    );
  });
});

describe("canonical AccountSnapshot equipment integrity", () => {
  it("rejects unsafe persisted achievement capture revisions", () => {
    const account = makeAccountSnapshot();
    account.achievementCompletion = {
      completedIds: [],
      capture: {
        coverage: "complete",
        source: {
          kind: "packetCapture",
          revision: "capture account=secret",
        },
        importedAt: "2026-09-04T06:00:00.000Z",
      },
    };

    expect(AccountSnapshotSchema.safeParse(account).success).toBe(false);
  });

  it.each([
    ["zero", [0]],
    ["larger than u32", [0x1_0000_0000]],
    ["duplicate", [101, 101]],
    ["unsorted", [102, 101]],
  ])("rejects %s completed achievement IDs", (_label, completedIds) => {
    const account = makeAccountSnapshot();
    account.achievementCompletion = { completedIds };

    expect(AccountSnapshotSchema.safeParse(account).success).toBe(false);
  });

  it("accepts unknown lock states and truly reference-free partial sections", () => {
    const unknownStates = makeAccountSnapshot();
    unknownStates.lightCones[0]!.locked = null;
    unknownStates.relics[0]!.locked = null;
    unknownStates.relics[0]!.discarded = null;
    expect(AccountSnapshotSchema.safeParse(unknownStates).success).toBe(true);

    const emptyPartial: AccountSnapshot = {
      ...makeAccountSnapshot(),
      characters: [],
      lightCones: [],
      relics: [],
      source: {
        ...makeAccountSnapshot().source,
        coverage: {
          characters: "unknown" as const,
          lightCones: "unknown" as const,
          relics: "unknown" as const,
        },
      },
    };
    expect(AccountSnapshotSchema.safeParse(emptyPartial).success).toBe(true);

    const charactersOnly = structuredClone(emptyPartial);
    charactersOnly.characters = structuredClone(
      makeAccountSnapshot().characters
    );
    delete charactersOnly.characters[0]!.lightConeKey;
    charactersOnly.characters[0]!.relicKeys = [];
    expect(AccountSnapshotSchema.safeParse(charactersOnly).success).toBe(true);

    const equipmentOnly = structuredClone(emptyPartial);
    equipmentOnly.lightCones = structuredClone(
      makeAccountSnapshot().lightCones
    );
    equipmentOnly.relics = structuredClone(makeAccountSnapshot().relics);
    delete equipmentOnly.lightCones[0]!.equippedCharacterKey;
    delete equipmentOnly.relics[0]!.equippedCharacterKey;
    expect(AccountSnapshotSchema.safeParse(equipmentOnly).success).toBe(true);
  });

  it.each([
    ["Character", "characters"],
    ["Light Cone", "lightCones"],
    ["Relic", "relics"],
  ] as const)("rejects duplicate %s instance keys", (label, collection) => {
    const account = makeAccountSnapshot();
    const record = account[collection][0]!;
    account[collection].push(structuredClone(record) as never);

    expect(() => AccountSnapshotSchema.parse(account)).toThrow(
      new RegExp(`Duplicate ${label} instance key`)
    );
  });

  it("rejects dangling Character and equipment references", () => {
    const danglingCharacterLightCone = makeAccountSnapshot();
    danglingCharacterLightCone.characters[0]!.lightConeKey =
      "light-cone:missing";
    expect(() =>
      AccountSnapshotSchema.parse(danglingCharacterLightCone)
    ).toThrow(/Character Light Cone reference does not exist/);

    const danglingCharacterRelic = makeAccountSnapshot();
    danglingCharacterRelic.characters[0]!.relicKeys = ["relic:missing"];
    expect(() => AccountSnapshotSchema.parse(danglingCharacterRelic)).toThrow(
      /Character Relic reference does not exist/
    );

    const danglingLightConeCharacter = makeAccountSnapshot();
    danglingLightConeCharacter.lightCones[0]!.equippedCharacterKey =
      "character:missing";
    expect(() =>
      AccountSnapshotSchema.parse(danglingLightConeCharacter)
    ).toThrow(/Light Cone equipped Character reference does not exist/);

    const danglingRelicCharacter = makeAccountSnapshot();
    danglingRelicCharacter.relics[0]!.equippedCharacterKey =
      "character:missing";
    expect(() => AccountSnapshotSchema.parse(danglingRelicCharacter)).toThrow(
      /Relic equipped Character reference does not exist/
    );
  });

  it("requires exact two-way Character and equipment agreement", () => {
    const missingCharacterLightConeRef = makeAccountSnapshot();
    delete missingCharacterLightConeRef.characters[0]!.lightConeKey;
    expect(() =>
      AccountSnapshotSchema.parse(missingCharacterLightConeRef)
    ).toThrow(/Light Cone and Character equipment references must agree/);

    const missingLightConeBackref = makeAccountSnapshot();
    delete missingLightConeBackref.lightCones[0]!.equippedCharacterKey;
    expect(() => AccountSnapshotSchema.parse(missingLightConeBackref)).toThrow(
      /Character and Light Cone equipment references must agree/
    );

    const missingCharacterRelicRef = makeAccountSnapshot();
    missingCharacterRelicRef.characters[0]!.relicKeys = [];
    expect(() => AccountSnapshotSchema.parse(missingCharacterRelicRef)).toThrow(
      /Relic and Character equipment references must agree/
    );

    const missingRelicBackref = makeAccountSnapshot();
    delete missingRelicBackref.relics[0]!.equippedCharacterKey;
    expect(() => AccountSnapshotSchema.parse(missingRelicBackref)).toThrow(
      /Character and Relic equipment references must agree/
    );

    const duplicateCharacterRelicRef = makeAccountSnapshot();
    duplicateCharacterRelicRef.characters[0]!.relicKeys.push("relic:1");
    expect(() =>
      AccountSnapshotSchema.parse(duplicateCharacterRelicRef)
    ).toThrow(/Character Relic reference is duplicated/);
  });

  it("allows at most one Light Cone and one Relic per slot per Character", () => {
    const duplicateLightCone = makeAccountSnapshot();
    duplicateLightCone.lightCones.push({
      ...duplicateLightCone.lightCones[0]!,
      key: "light-cone:2",
    });
    expect(() => AccountSnapshotSchema.parse(duplicateLightCone)).toThrow(
      /cannot equip more than one Light Cone/
    );

    const duplicateSlot = makeAccountSnapshot();
    duplicateSlot.characters[0]!.relicKeys.push("relic:2");
    duplicateSlot.relics.push({
      ...duplicateSlot.relics[0]!,
      key: "relic:2",
    });
    expect(() => AccountSnapshotSchema.parse(duplicateSlot)).toThrow(
      /cannot equip more than one Relic in slot head/
    );
  });
});
