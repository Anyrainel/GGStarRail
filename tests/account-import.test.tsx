import { render, screen, waitFor } from "@testing-library/react";
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
import {
  parseVersionedScannerExport,
  SCANNER_WARNING_DISCARD_NOT_IMPORTED,
  SCANNER_WARNING_TRACES_NOT_INCLUDED,
  SCANNER_WARNING_UNKNOWN_LOCK_DEFAULTED,
} from "@/providers/scanner/schema";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";
import goodScannerFixture from "./fixtures/goodscanner-hsr-experimental-v1.json";

afterEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
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
          mainStat: { statId: "AttackAddedRatio", value: 38.8 },
          equippedCharacterKey: "character-001",
        },
      ],
      source: {
        provider: "scanner-export",
        sourceRevision: "014e33e2404f8cd668bf06fc2ea6db53b6bc3992",
        importedAt: "2026-08-30T12:00:00.000Z",
      },
    });
    expect(draft.warnings).toEqual([
      SCANNER_WARNING_TRACES_NOT_INCLUDED,
      SCANNER_WARNING_UNKNOWN_LOCK_DEFAULTED,
      SCANNER_WARNING_DISCARD_NOT_IMPORTED,
    ]);
    expect(AccountSnapshotSchema.parse(draft.account)).toEqual(draft.account);
  });

  it("rejects unsafe privacy flags, revision drift, and unknown public IDs", async () => {
    const unsafe = structuredClone(goodScannerFixture);
    unsafe.privacy.accountIdentifiersIncluded = true;
    await expect(parseVersionedScannerExport(unsafe)).rejects.toThrow();

    const revisionDrift = structuredClone(goodScannerFixture);
    revisionDrift.reference.revision = "0".repeat(40);
    await expect(parseVersionedScannerExport(revisionDrift)).rejects.toThrow(
      /does not match catalog revision/
    );

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
    expect(account.relics).toHaveLength(12);
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

    await user.upload(
      screen.getByLabelText("Choose JSON file"),
      new File(["{not-json"], "broken.json", { type: "application/json" })
    );

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

    await user.upload(
      screen.getByLabelText("Choose JSON file"),
      new File([JSON.stringify(goodScannerFixture)], "account.json", {
        type: "application/json",
      })
    );

    expect(await screen.findByText("Review before import")).toBeInTheDocument();
    expect(useWorkspaceStore.getState().account).toEqual(existing);
    await user.click(
      screen.getByRole("button", { name: "Replace local account" })
    );
    await waitFor(() => {
      expect(useWorkspaceStore.getState().account?.profileId).toBe(
        "scanner:local"
      );
    });
  });
});
