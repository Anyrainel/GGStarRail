import { describe, expect, it } from "vitest";
import type { PriorityAssignments } from "@/domain/tier-list/types";
import { compareCharacterPriority } from "@/domain/tier-list/utils";

const assignments: PriorityAssignments = {
  top: { tier: "S", position: 0 },
  second: { tier: "S", position: 1 },
  low: { tier: "D", position: 0 },
};

describe("Character priority sorting", () => {
  it("honors tier and placement order with unassigned characters last", () => {
    const ids = ["unassigned", "second", "low", "top"];
    expect(
      [...ids].sort((a, b) =>
        compareCharacterPriority(a, b, assignments, "descending")
      )
    ).toEqual(["top", "second", "low", "unassigned"]);
    expect(
      [...ids].sort((a, b) =>
        compareCharacterPriority(a, b, assignments, "ascending")
      )
    ).toEqual(["low", "second", "top", "unassigned"]);
    expect(
      compareCharacterPriority(
        "unknown",
        "unassigned",
        assignments,
        "descending"
      )
    ).toBe(0);
  });
});
