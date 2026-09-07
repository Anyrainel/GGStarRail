import { describe, expect, it } from "vitest";
import {
  mergeBetaCharacterEnhancements,
  mergeReleasedData,
  restoreLocalizedText,
  restoreSourceRevision,
} from "@/data/gameDataUtil";

describe("partitioned game data", () => {
  it("hydrates revision metadata without substituting user-facing text or other sources", () => {
    expect(
      restoreSourceRevision(
        {
          source_revision: "$source_revision",
          nested: [
            { source_revision: "$source_revision", text: "$source_revision" },
            { source_revision: "nanoka-version" },
          ],
        },
        "abc"
      )
    ).toEqual({
      source_revision: "abc",
      nested: [
        { source_revision: "abc", text: "$source_revision" },
        { source_revision: "nanoka-version" },
      ],
    });
  });
  it("adds opt-in enhancements without replacing released character stats", () => {
    const released = { value: [{ id: "1004", hp: 200, enhancements: [] }] };
    const beta = {
      value: [{ id: "1004", hp: 100, enhancements: [{ enhanced_id: 1 }] }],
    };
    expect(
      mergeBetaCharacterEnhancements(mergeReleasedData(released, beta), beta)
    ).toEqual({
      value: [{ id: "1004", hp: 200, enhancements: [{ enhanced_id: 1 }] }],
    });
  });
  it("restores nested bilingual text without changing numeric fields", () => {
    const en = { "/value/0/name": { value: "March" } };
    const zh = { "/value/0/name": { value: "三月" } };
    expect(
      restoreLocalizedText(
        [{ id: "1001", name: { $text: "/value/0/name" }, hp: 100 }],
        en,
        zh
      )
    ).toEqual([
      {
        id: "1001",
        name: { en: en["/value/0/name"], "zh-CN": zh["/value/0/name"] },
        hp: 100,
      },
    ]);
  });

  it("rejects incomplete locale files instead of hiding corrupt exports", () => {
    expect(() => restoreLocalizedText({ $text: "/missing" }, {}, {})).toThrow(
      "Missing localized game text"
    );
  });

  it("keeps the entire released entity when beta has stale fields", () => {
    expect(
      mergeReleasedData(
        { value: [{ id: "released", hp: 200 }] },
        {
          value: [
            { id: "released", hp: 100, unreleasedSkill: true },
            { id: "new", hp: 50 },
          ],
        }
      )
    ).toEqual({
      value: [
        { id: "released", hp: 200 },
        { id: "new", hp: 50 },
      ],
    });
  });
});
