import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AccountImportPanel } from "@/components/account/AccountImportPanel";
import { AccountSnapshotSchema } from "@/domain/account/schemas";
import { I18nProvider } from "@/i18n/I18nContext";
import { createDemoAccount } from "@/lib/demoAccount";
import {
  loadCharacters,
  loadLightCones,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";
import type { HoYoLabImportInput } from "@/providers/hoyolab/ephemeralAuth";
import {
  parseVersionedScannerExport,
  SCANNER_WARNING_REFERENCE_REVISION_MISMATCH,
  SCANNER_WARNING_SANITIZED_FIXTURE,
  SCANNER_WARNING_TRACES_NOT_INCLUDED,
  SCANNER_WARNING_UNKNOWN_DISCARD_STATE,
  SCANNER_WARNING_UNKNOWN_LOCK_STATE,
  SCANNER_WARNING_V1_COVERAGE_UNKNOWN,
} from "@/providers/scanner/schema";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";
import goodScannerFixture from "./fixtures/goodscanner-hsr-experimental-v1.json";

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("Account import and demo workflows", () => {
  it("adapts the audited GOODScanner experimental v1 envelope", async () => {
    const draft = await parseVersionedScannerExport(
      goodScannerFixture,
      new Date("2026-08-30T12:00:00.000Z")
    );

    expect(draft.account).toMatchObject({
      profileId: "scanner:local",
      characters: [
        {
          key: "character-001",
          definitionId: "1001",
          pathId: "Knight",
          combatTypeId: "Ice",
          lightConeKey: "light-cone-001",
          relicKeys: ["planar-001"],
        },
      ],
      lightCones: [
        {
          definitionId: "23005",
          equippedCharacterKey: "character-001",
        },
      ],
      relics: [
        {
          definitionId: "61011",
          slot: "head",
          mainStat: { statId: "HPDelta", value: 705.6 },
        },
        {
          definitionId: "63015",
          slot: "planarSphere",
          mainStat: { statId: "AttackAddedRatio", value: 35.9424 },
          equippedCharacterKey: "character-001",
        },
      ],
      source: {
        provider: "scanner-export",
        sourceRevision: "014e33e2404f8cd668bf06fc2ea6db53b6bc3992",
        importedAt: "2026-08-30T12:00:00.000Z",
        coverage: {
          characters: "unknown",
          lightCones: "unknown",
          relics: "unknown",
        },
      },
    });
    expect(draft.warnings).toEqual([
      SCANNER_WARNING_TRACES_NOT_INCLUDED,
      SCANNER_WARNING_V1_COVERAGE_UNKNOWN,
      SCANNER_WARNING_SANITIZED_FIXTURE,
      SCANNER_WARNING_UNKNOWN_LOCK_STATE,
      SCANNER_WARNING_UNKNOWN_DISCARD_STATE,
    ]);
    expect(AccountSnapshotSchema.parse(draft.account)).toEqual(draft.account);
  });

  it("rejects unsafe privacy and unknown IDs while warning on compatible revision drift", async () => {
    const unsafe = structuredClone(goodScannerFixture);
    unsafe.privacy.accountIdentifiersIncluded = true;
    await expect(parseVersionedScannerExport(unsafe)).rejects.toThrow();

    const revisionDrift = structuredClone(goodScannerFixture);
    revisionDrift.reference.revision = "0".repeat(40);
    await expect(
      parseVersionedScannerExport(revisionDrift)
    ).resolves.toMatchObject({
      warnings: expect.arrayContaining([
        SCANNER_WARNING_REFERENCE_REVISION_MISMATCH,
      ]),
    });

    const unknownCharacter = structuredClone(goodScannerFixture);
    unknownCharacter.characters[0].key = "999999";
    unknownCharacter.characters[0].gameId = 999999;
    await expect(parseVersionedScannerExport(unknownCharacter)).rejects.toThrow(
      /Unknown Character/
    );
  });

  it("builds a deterministic demo only from audited catalog IDs and affixes", async () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    const [
      account,
      repeated,
      characters,
      lightCones,
      relicPieces,
      relicSets,
      properties,
    ] = await Promise.all([
      createDemoAccount(now),
      createDemoAccount(now),
      loadCharacters(),
      loadLightCones(),
      loadRelicPieces(),
      loadRelicSets(),
      loadPropertyTables(),
    ]);

    expect(account).toEqual(repeated);
    expect(account.source.provider).toBe("demo-account");
    expect(account.characters).toHaveLength(6);
    expect(account.lightCones).toHaveLength(6);
    expect(account.relics).toHaveLength(20);
    for (const character of account.characters) {
      expect(characters.byId.has(character.definitionId)).toBe(true);
    }
    for (const lightCone of account.lightCones) {
      expect(lightCones.byId.has(lightCone.definitionId)).toBe(true);
    }
    for (const relic of account.relics) {
      expect(relicPieces.byId.has(relic.definitionId)).toBe(true);
      expect(relicSets.byId.has(relic.setId)).toBe(true);
      expect(properties.propertyById.has(relic.mainStat.statId)).toBe(true);
      expect(
        relic.substats.every((stat) => properties.propertyById.has(stat.statId))
      ).toBe(true);
    }
  });

  it("does not mutate the current account when file parsing fails", async () => {
    const existing = makeAccountSnapshot();
    useWorkspaceStore.getState().replaceAccount(existing);
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AccountImportPanel />
      </I18nProvider>
    );

    await act(async () => {
      await user.upload(
        screen.getByLabelText("Choose JSON file"),
        new File(["{not-json"], "broken.json", { type: "application/json" })
      );
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "your current account data was not changed"
    );
    expect(useWorkspaceStore.getState().account).toEqual(existing);
  });

  it("reviews a valid file before applying it to the store", async () => {
    const existing = makeAccountSnapshot();
    useWorkspaceStore.getState().replaceAccount(existing);
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AccountImportPanel />
      </I18nProvider>
    );

    await act(async () => {
      await user.upload(
        screen.getByLabelText("Choose JSON file"),
        new File([JSON.stringify(goodScannerFixture)], "account.json", {
          type: "application/json",
        })
      );
    });

    expect(await screen.findByText("Review before import")).toBeInTheDocument();
    expect(useWorkspaceStore.getState().account).toEqual(existing);
    expect(
      screen.getByText("Account identity cannot be verified")
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Merge as same account" })
    );
    await waitFor(() => {
      expect(useWorkspaceStore.getState().account?.profileId).toBe(
        "profile:local"
      );
    });
  });

  it("reviews a UID showcase and merges it without deleting fuller local inventory", async () => {
    const existing = makeAccountSnapshot();
    useWorkspaceStore.getState().replaceAccount(existing);
    const uidImporter = async (uid: string) => {
      expect(uid).toBe("600000001");
      return {
        account: {
          ...existing,
          characters: [],
          lightCones: [],
          relics: [],
          source: {
            provider: "uid-showcase" as const,
            formatVersion: 1,
            sourceVersion: "enka-hsr-showcase-v1",
            importedAt: "2026-09-02T12:00:00.000Z",
            coverage: {
              characters: "showcase-only" as const,
              lightCones: "showcase-only" as const,
              relics: "showcase-only" as const,
            },
            warnings: ["UID_SHOWCASE_ONLY"],
          },
        },
        warnings: ["UID_SHOWCASE_ONLY"],
      };
    };
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AccountImportPanel uidImporter={uidImporter} />
      </I18nProvider>
    );

    await user.type(
      screen.getAllByLabelText("Star Rail UID")[0] as HTMLInputElement,
      "600000001"
    );
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: "Review UID showcase" })
      );
    });
    expect(await screen.findByText("Review before import")).toBeInTheDocument();
    expect(screen.getAllByText(/Profile showcase only/)).toHaveLength(3);
    await user.click(
      screen.getByRole("button", { name: "Merge matching account" })
    );

    expect(useWorkspaceStore.getState().account?.relics).toEqual(
      existing.relics
    );
    expect(useWorkspaceStore.getState().account?.source.warnings).toContain(
      "PARTIAL_IMPORT_MERGED_WITH_LOCAL_DATA"
    );
  });

  it("requires an explicit confirmation before replacing a different UID", async () => {
    const existing = makeAccountSnapshot();
    useWorkspaceStore.getState().replaceAccount(existing);
    const incoming = {
      ...existing,
      profileId: "account:700000001",
      uid: "700000001",
      source: {
        provider: "uid-showcase" as const,
        formatVersion: 1,
        sourceVersion: "enka-hsr-showcase-v1",
        importedAt: "2026-09-02T12:00:00.000Z",
        coverage: {
          characters: "showcase-only" as const,
          lightCones: "showcase-only" as const,
          relics: "showcase-only" as const,
        },
        warnings: ["UID_SHOWCASE_ONLY"],
      },
    };
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AccountImportPanel
          uidImporter={async () => ({
            account: incoming,
            warnings: incoming.source.warnings,
          })}
        />
      </I18nProvider>
    );

    await user.type(
      screen.getAllByLabelText("Star Rail UID")[0] as HTMLInputElement,
      "700000001"
    );
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: "Review UID showcase" })
      );
    });
    expect(
      await screen.findByText("Different UID (replacement required)")
    ).toBeInTheDocument();
    const replace = screen.getByRole("button", {
      name: "Replace current account",
    });
    expect(replace).toBeDisabled();
    await user.click(
      screen.getByLabelText(
        "I understand this replaces the current local account snapshot."
      )
    );
    expect(replace).toBeEnabled();
    await user.click(replace);
    expect(useWorkspaceStore.getState().account?.uid).toBe("700000001");
  });

  it("clears transient credential fields after one reviewed request", async () => {
    const account = makeAccountSnapshot();
    const hoYoLabImporter = async (input: HoYoLabImportInput) => {
      await input.auth.consumeOnce(async ({ credentials, device }) => {
        expect(credentials).toEqual({
          kind: "raw-cookie",
          rawCookie: "ltuid_v2=600000001; ltoken_v2=one-use-value",
        });
        expect(device).toEqual({
          deviceId: "test-device-id",
          deviceFp: "1234567890123",
        });
        return undefined;
      });
      return {
        account: {
          ...account,
          source: {
            provider: "hoyolab-account" as const,
            formatVersion: 1,
            sourceVersion: "hoyolab-hkrpg-avatar-info-os-fixture-v1",
            importedAt: "2026-09-02T12:00:00.000Z",
            coverage: {
              characters: "complete" as const,
              lightCones: "equipped-only" as const,
              relics: "equipped-only" as const,
            },
            warnings: ["HOYOLAB_AUTH_LIVE_UNVERIFIED"],
          },
        },
        warnings: ["HOYOLAB_AUTH_LIVE_UNVERIFIED"],
      };
    };
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AccountImportPanel hoYoLabImporter={hoYoLabImporter} />
      </I18nProvider>
    );

    const uidFields = screen.getAllByLabelText(
      "Star Rail UID"
    ) as HTMLInputElement[];
    const cookie = screen.getByLabelText(
      "Cookie header"
    ) as HTMLTextAreaElement;
    const device = screen.getByLabelText("Device ID") as HTMLInputElement;
    const fingerprint = screen.getByLabelText(
      "Device fingerprint"
    ) as HTMLInputElement;
    await user.type(uidFields[1] as HTMLInputElement, "600000001");
    await user.type(cookie, "ltuid_v2=600000001; ltoken_v2=one-use-value");
    await user.type(device, "test-device-id");
    await user.type(fingerprint, "1234567890123");
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: "Review equipped account data" })
      );
    });

    expect(await screen.findByText("Review before import")).toBeInTheDocument();
    expect(cookie).toHaveValue("");
    expect(device).toHaveValue("");
    expect(fingerprint).toHaveValue("");
  });

  it("confirms before replacing a real local snapshot with demo data", async () => {
    const existing = makeAccountSnapshot();
    useWorkspaceStore.getState().replaceAccount(existing);
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AccountImportPanel />
      </I18nProvider>
    );

    await user.click(screen.getByRole("button", { name: "Replace with demo" }));

    const confirmation = screen.getByRole("dialog", {
      name: "Replace this account with demo data?",
    });
    expect(useWorkspaceStore.getState().account).toEqual(existing);
    await act(async () => {
      await user.click(
        within(confirmation).getByRole("button", { name: "Replace with demo" })
      );
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().account?.source.provider).toBe(
        "demo-account"
      );
    });
  });
});
