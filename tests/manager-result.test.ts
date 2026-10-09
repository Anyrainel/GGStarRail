import { describe, expect, it } from "vitest";
import {
  type ManagerInstructionEnvelope,
  matcherForRelic,
} from "@/lib/managerInstructions";
import { reconcileManagerResult } from "@/lib/managerResult";
import type { ScannerResult } from "@/lib/scannerManager";
import { createDemoAccount } from "./fixtures/demoAccount";

describe("verified manager state reconciliation", () => {
  it("patches only uniquely matched verified changes and preserves all inventory and identity", async () => {
    const base = await createDemoAccount();
    const target = base.relics.find((relic) => !relic.equippedCharacterKey);
    if (!target) throw new Error("fixture must include unequipped gear");
    const relic = { ...target, locked: false, discarded: false };
    const account = {
      ...base,
      relics: base.relics.map((item) =>
        item.key === relic.key ? relic : item
      ),
    };
    const matcher = matcherForRelic(relic, null);
    if (!matcher) throw new Error("fixture must have public matcher");
    const envelope: ManagerInstructionEnvelope = {
      schema: "goodscanner.hsr.manager-instructions",
      schemaVersion: 1,
      requestId: "request-1",
      idempotencyKey: `sha256:${"0".repeat(64)}`,
      reference: {
        schemaVersion: 1,
        provider: "gilore.ggstarrail-reference",
        revision: "fixture",
      },
      privacy: {
        accountIdentifiersIncluded: false,
        rawPacketDataIncluded: false,
        serverItemIdentifiersIncluded: false,
      },
      instructions: [
        {
          id: "lock-1",
          matcher,
          before: { lock: false, discard: false },
          desired: { lock: true },
        },
      ],
    };
    const result: ScannerResult = {
      jobId: "job-1",
      kind: "manage",
      verified: 1,
      skipped: 0,
      needsReview: 0,
      total: 1,
      instructions: [],
      entries: [
        {
          instructionId: "lock-1",
          status: "verified",
          change: { field: "lock", before: false, desired: true },
        },
      ],
    };
    const updated = reconcileManagerResult(account, envelope, result);
    expect(updated.relics.find((item) => item.key === relic.key)?.locked).toBe(
      true
    );
    expect(updated.relics.length).toBe(account.relics.length);
    expect(updated.profileId).toEqual(account.profileId);
    expect(updated.uid).toEqual(account.uid);
    expect(account.relics.find((item) => item.key === relic.key)?.locked).toBe(
      false
    );
    for (const status of [
      "pending",
      "mutationStarted",
      "needsReview",
    ] as const) {
      expect(
        reconcileManagerResult(account, envelope, {
          ...result,
          entries: [{ ...result.entries[0], status }],
        })
      ).toEqual(account);
    }
    const ambiguous = {
      ...account,
      relics: [...account.relics, { ...relic, key: `${relic.key}-copy` }],
    };
    expect(reconcileManagerResult(ambiguous, envelope, result)).toEqual(
      ambiguous
    );
    const altered = {
      ...envelope,
      instructions: [
        { ...envelope.instructions[0], desired: { discard: true } },
      ],
    };
    expect(reconcileManagerResult(account, altered, result)).toEqual(account);
  });
});
