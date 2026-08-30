import { describe, expect, it } from "vitest";
import {
  createBackupEnvelope,
  parseBackup,
  serializeBackup,
} from "@/lib/backup";
import { migrateWorkspace } from "@/stores/migration/workspace";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { makeAccountSnapshot } from "./fixtures";

describe("independent persistence and backup identity", () => {
  it("round-trips only the GGStarRail envelope", () => {
    const workspace = {
      ...structuredClone(DEFAULT_WORKSPACE),
      account: makeAccountSnapshot(),
    };
    const serialized = serializeBackup(workspace);
    const parsed = parseBackup(serialized);
    expect(parsed.product).toBe("GGStarRail");
    expect(parsed.kind).toBe("ggstarrail.backup");
    expect(parsed.payload.account?.characters).toHaveLength(1);
    expect(serialized).not.toContain("GenshinTools");
    expect(serialized).not.toContain("GGArtifact");
  });

  it("rejects cross-product and sensitive-shaped payloads", () => {
    const valid = createBackupEnvelope(DEFAULT_WORKSPACE);
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, product: "GenshinTools" }))
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({ ...valid, payload: { ...valid.payload, ltoken: "x" } })
      )
    ).toThrow(/Sensitive field/);
  });

  it("keeps the first store migration boundary closed to unknown versions", () => {
    expect(migrateWorkspace({ account: "legacy" }, 0)).toEqual(
      DEFAULT_WORKSPACE
    );
    expect(migrateWorkspace({ malformed: true }, 1)).toEqual(DEFAULT_WORKSPACE);
  });
});
