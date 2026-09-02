import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { PersistedPriorityStoreSchema } from "@/domain/tier-list/schemas";
import { migratePriorityStore } from "@/stores/migration/priority";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useLightConePriorityStore } from "@/stores/useLightConePriorityStore";
import { useRelicPriorityStore } from "@/stores/useRelicPriorityStore";

function resetStores() {
  useCharacterPriorityStore.getState().resetPriorities();
  useLightConePriorityStore.getState().resetPriorities();
  useRelicPriorityStore.getState().resetPriorities();
}

describe("HSR priority persistence", () => {
  beforeEach(resetStores);

  it("keeps the three user-authored lists independent under product keys", () => {
    useCharacterPriorityStore.getState().setPriorityState({
      assignments: { "character:1001": { tier: "S", position: 0 } },
    });
    useRelicPriorityStore.getState().setPriorityState({
      assignments: { "relic:101": { tier: "A", position: 0 } },
      groupAssignments: { "relic:101": "support" },
    });

    expect(useCharacterPriorityStore.getState().assignments).toEqual({
      "character:1001": { tier: "S", position: 0 },
    });
    expect(useLightConePriorityStore.getState().assignments).toEqual({});
    expect(useRelicPriorityStore.getState()).toMatchObject({
      assignments: { "relic:101": { tier: "A", position: 0 } },
      groupAssignments: { "relic:101": "support" },
    });

    for (const key of [
      STORAGE_KEYS.characterPriority,
      STORAGE_KEYS.lightConePriority,
      STORAGE_KEYS.relicPriority,
    ]) {
      expect(key.startsWith("ggstarrail:")).toBe(true);
      expect(localStorage.getItem(key)).not.toBeNull();
    }
  });

  it("migrates the assignment-only v0 shape without inventing Relic roles", () => {
    expect(
      migratePriorityStore(
        {
          assignments: {
            "light-cone:20001": { tier: "B", position: 2 },
          },
        },
        0
      )
    ).toEqual({
      schemaVersion: 1,
      assignments: {
        "light-cone:20001": { tier: "B", position: 2 },
      },
      groupAssignments: {},
      updatedAt: 0,
    });
  });

  it("rejects malformed tiers, positions, and Relic role values", () => {
    expect(
      PersistedPriorityStoreSchema.safeParse({
        schemaVersion: 1,
        assignments: { a: { tier: "SS", position: -1 } },
        groupAssignments: { a: "healer" },
        updatedAt: 0,
      }).success
    ).toBe(false);
    expect(
      migratePriorityStore(
        {
          schemaVersion: 1,
          assignments: { a: { tier: "SS", position: -1 } },
          groupAssignments: { a: "healer" },
          updatedAt: 0,
        },
        1
      )
    ).toMatchObject({
      schemaVersion: 1,
      assignments: {},
      groupAssignments: {},
    });
  });
});
