import { describe, expect, it, vi } from "vitest";
import { importFromUidShowcase } from "@/providers/enka/client";
import {
  normalizeEnkaHsrShowcase,
  UID_WARNING_EMPTY_SHOWCASE,
  UID_WARNING_SUBSTAT_MAIN_COLLISION,
} from "@/providers/enka/schema";
import {
  HOYOLAB_WARNING_AUTH_LIVE_UNVERIFIED,
  normalizeHoYoLabAvatarInfo,
} from "@/providers/hoyolab/schema";
import { loadAccountImportCatalog } from "@/providers/importCatalog";
import {
  normalizeMiHoMoRawShowcase,
  UID_WARNING_MIHOMO_FALLBACK_USED,
  UID_WARNING_MIHOMO_INCOMPLETE_AFFIX,
} from "@/providers/mihomo/schema";
import enkaFixture from "./fixtures/enka-hsr-showcase.json";
import hoyolabFixture from "./fixtures/hoyolab-hsr-avatar-info.json";
import mihomoFixture from "./fixtures/mihomo-hsr-raw.json";

const importedAt = new Date("2026-09-02T12:00:00.000Z");

describe("HSR account provider normalization", () => {
  it("normalizes Enka showcase affix rolls with flat and ratio units", async () => {
    const catalog = await loadAccountImportCatalog();
    const result = normalizeEnkaHsrShowcase(
      enkaFixture,
      catalog,
      importedAt,
      "600000001"
    );

    expect(result.account.source.coverage).toEqual({
      characters: "showcase-only",
      lightCones: "showcase-only",
      relics: "showcase-only",
    });
    expect(result.account.source.sourceVersion).toBe("enka-hsr-showcase-v1");
    expect(result.account.source.sourceRevision).toMatch(
      /^gilore-ref:[a-f0-9]{40}$/
    );
    expect(result.account.characters).toHaveLength(1);
    expect(result.account.lightCones[0]?.locked).toBeNull();
    expect(result.account.relics[0]).toMatchObject({
      key: "account:600000001:relic:1001:head",
      mainStat: { statId: "HPDelta", value: 705.6 },
      locked: null,
      discarded: null,
    });
    expect(result.account.relics[0]?.substats).toEqual([
      { statId: "CriticalChanceBase", value: 5.508 },
      { statId: "AttackDelta", value: 21.169 },
    ]);
  });

  it("warns and omits a substat that collides with the main stat", async () => {
    const catalog = await loadAccountImportCatalog();
    const input = structuredClone(enkaFixture);
    input.detailInfo.avatarDetailList[0].relicList[0].subAffixList[0] = {
      affixId: 1,
      cnt: 1,
      step: 0,
    };
    const result = normalizeEnkaHsrShowcase(input, catalog, importedAt);

    expect(result.account.relics[0]?.substats).toEqual([
      { statId: "AttackDelta", value: 21.169 },
    ]);
    expect(result.warnings).toContain(
      `${UID_WARNING_SUBSTAT_MAIN_COLLISION}:61011:HPDelta`
    );
  });

  it("accepts an empty or private showcase as explicit partial state", async () => {
    const catalog = await loadAccountImportCatalog();
    const input = structuredClone(enkaFixture);
    input.detailInfo.isDisplayAvatar = false;
    input.detailInfo.avatarDetailList = [];
    const result = normalizeEnkaHsrShowcase(input, catalog, importedAt);

    expect(result.account.characters).toEqual([]);
    expect(result.warnings).toContain(UID_WARNING_EMPTY_SHOWCASE);
  });

  it("normalizes MiHoMo raw support and display lists as one showcase", async () => {
    const catalog = await loadAccountImportCatalog();
    const result = normalizeMiHoMoRawShowcase(
      mihomoFixture,
      catalog,
      importedAt,
      "600000001"
    );

    expect(
      result.account.characters.map(({ definitionId }) => definitionId)
    ).toEqual(["1001", "1002"]);
    expect(result.account.characters[0]?.relicKeys).toHaveLength(1);
    expect(result.account.source.sourceVersion).toBe("mihomo-hsr-raw-v1");
    expect(result.warnings).toContain(UID_WARNING_MIHOMO_FALLBACK_USED);
  });

  it("drops an incomplete MiHoMo affix without rejecting the showcase", async () => {
    const catalog = await loadAccountImportCatalog();
    const input = structuredClone(mihomoFixture);
    const incompleteAffix = input.detailInfo.avatarDetailList[0].relicList[0]
      .subAffixList[0] as { cnt?: number };
    delete incompleteAffix.cnt;
    const result = normalizeMiHoMoRawShowcase(
      input,
      catalog,
      importedAt,
      "600000001"
    );

    expect(result.account.relics[0]?.substats).toEqual([
      { statId: "AttackDelta", value: 21.169 },
    ]);
    expect(result.warnings).toContain(
      `${UID_WARNING_MIHOMO_INCOMPLETE_AFFIX}:1001:61011:8`
    );
  });

  it("preserves a MiHoMo 200 response with no public detail as empty partial state", async () => {
    const catalog = await loadAccountImportCatalog();
    const result = normalizeMiHoMoRawShowcase(
      { detailInfo: null },
      catalog,
      importedAt,
      "600000001"
    );

    expect(result.account.characters).toEqual([]);
    expect(result.warnings).toContain(UID_WARNING_EMPTY_SHOWCASE);
    expect(result.account.source.sourceVersion).toBe("mihomo-hsr-raw-v1");
  });

  it("selects the normalizer named by the UID proxy envelope", async () => {
    const catalog = await loadAccountImportCatalog();
    const transport = vi.fn(async () => ({
      source: {
        kind: "mihomo",
        endpointVersion: "mihomo-hsr-raw-v1",
        coverage: "showcase-only",
      },
      data: mihomoFixture,
    }));
    const result = await importFromUidShowcase("600000001", {
      catalog,
      now: importedAt,
      transport,
    });

    expect(transport).toHaveBeenCalledWith("600000001");
    expect(result.account.source.sourceVersion).toBe("mihomo-hsr-raw-v1");
  });

  it("normalizes HoYoLAB equipped-only data and preserves source transport", async () => {
    const catalog = await loadAccountImportCatalog();
    const result = normalizeHoYoLabAvatarInfo(
      {
        source: {
          kind: "hoyolab-hkrpg-avatar-info",
          region: "os",
          transport: "global-primary",
        },
        data: hoyolabFixture,
      },
      { uid: "600000001", region: "os" },
      catalog,
      importedAt
    );

    expect(result.account.source.coverage).toEqual({
      characters: "complete",
      lightCones: "equipped-only",
      relics: "equipped-only",
    });
    expect(result.account.characters[0]?.ascension).toBe(6);
    expect(result.account.relics[0]).toMatchObject({
      mainStat: { statId: "HPDelta", value: 705 },
      substats: [
        { statId: "CriticalChanceBase", value: 5.8 },
        { statId: "AttackDelta", value: 42 },
      ],
      locked: null,
      discarded: null,
    });
    expect(result.account.source.sourceVersion).toBe(
      "hoyolab-hkrpg-avatar-info-global-primary-v1"
    );
    expect(result.warnings).toContain(HOYOLAB_WARNING_AUTH_LIVE_UNVERIFIED);
  });

  it("rejects UID and regional identity mismatches", async () => {
    const catalog = await loadAccountImportCatalog();
    expect(() =>
      normalizeEnkaHsrShowcase(enkaFixture, catalog, importedAt, "700000001")
    ).toThrow("UID_IMPORT_IDENTITY_MISMATCH");
    expect(() =>
      normalizeHoYoLabAvatarInfo(
        hoyolabFixture,
        { uid: "600000001", region: "cn" },
        catalog,
        importedAt
      )
    ).toThrow("HOYOLAB_IMPORT_REGION_MISMATCH");
  });
});
