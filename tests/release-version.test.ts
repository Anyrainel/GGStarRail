import { describe, expect, it } from "vitest";
import { compareReleaseVersionsDescending } from "@/lib/releaseVersion";

describe("archive release ordering", () => {
  it("orders numeric patch components newest first and keeps unknowns last", () => {
    expect(
      [null, "2.9", "4.1", "2.10", "1.0", "4.0", undefined].sort(
        compareReleaseVersionsDescending
      )
    ).toEqual(["4.1", "4.0", "2.10", "2.9", "1.0", null, undefined]);
    expect(compareReleaseVersionsDescending(undefined, "1.0")).toBeGreaterThan(
      0
    );
    expect(compareReleaseVersionsDescending("", null)).toBe(0);
  });

  it("leaves equal patches tied for in-game ordering without locale dependence", () => {
    expect(compareReleaseVersionsDescending("4.0", "4.0.0")).toBe(0);
    expect(compareReleaseVersionsDescending(" 3.7 ", "3.7")).toBe(0);
    expect(compareReleaseVersionsDescending("unknown", "1.0")).toBeGreaterThan(
      0
    );
  });
});
