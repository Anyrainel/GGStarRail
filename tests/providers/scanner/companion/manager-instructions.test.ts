import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RelicTriageEvaluation } from "@/domain/build/evaluation";
import {
  createManagerInstructionPreview,
  serializeManagerInstructionEnvelope,
} from "@/providers/scanner/companion/instructions";
import { makeAccountSnapshot, makeRelic } from "../../../fixtures";

describe("manager batch compatibility", () => {
  it("keeps ambiguous matches in preview without rejecting the executable batch", async () => {
    const account = makeAccountSnapshot();
    const relic = makeRelic({
      definitionId: "61011",
      setId: "101",
      mainStat: { statId: "HPDelta", value: 705.6 },
      substats: [
        { statId: "CriticalChanceBase", value: 8.7 },
        { statId: "SpeedDelta", value: 5 },
      ],
    });
    const duplicate = { ...relic, key: "duplicate-a", level: 12 };
    const discarded = {
      ...relic,
      key: "discard",
      substats: [relic.substats[0], { statId: "SpeedDelta", value: 4 }],
    };
    account.relics = [
      relic,
      duplicate,
      { ...duplicate, key: "duplicate-b" },
      discarded,
    ];
    const evaluations: RelicTriageEvaluation[] = account.relics.map((item) => ({
      relic: item,
      score: 0,
      grade: "D",
      matchingBuildIds: [],
      result: {
        decision: item.key === "discard" ? "salvage-review" : "keep",
        reasons: [],
      },
    }));
    const preview = await createManagerInstructionPreview(
      account,
      evaluations,
      "014e33e2404f8cd668bf06fc2ea6db53b6bc3992",
      "website-mixed-batch"
    );
    expect(preview.actionability).toMatchObject({
      actionableCount: 2,
      previewOnlyCount: 2,
      reasonCounts: { "ambiguous-matcher": 2, locked: 0 },
    });
    expect(preview.omittedInstructionIds).toHaveLength(2);
    expect(preview.envelope.instructions).toHaveLength(2);
    // The identical fixture is exercised by GGScanner's real HTTP /manage test.
    const golden = JSON.parse(
      readFileSync("tests/fixtures/scanner/manager-mixed-batch-v1.json", "utf8")
    );
    expect(
      JSON.parse(serializeManagerInstructionEnvelope(preview.envelope))
    ).toEqual(golden);
    const reordered = await createManagerInstructionPreview(
      account,
      [...evaluations].reverse(),
      preview.envelope.reference.revision,
      preview.envelope.requestId
    );
    expect(reordered.envelope).toEqual(preview.envelope);
  });
});
