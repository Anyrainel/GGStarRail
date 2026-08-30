import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface MutableManifest {
  schema_version: string;
  source: { source_id: string };
  files: Record<
    string,
    { byte_count: number; entity_count: number | null; sha256: string }
  >;
}

const generatedDirectory = path.resolve("src/generated/hsr-reference");
const validatorPath = path.resolve("scripts/sync-hsr-reference.mjs");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, value: unknown): Buffer {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.writeFileSync(filePath, bytes);
  return bytes;
}

function rewriteMember(
  directory: string,
  fileName: string,
  value: unknown,
  entityCount?: number
): void {
  const bytes = writeJson(path.join(directory, fileName), value);
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = readJson<MutableManifest>(manifestPath);
  manifest.files[fileName].byte_count = bytes.length;
  manifest.files[fileName].sha256 = createHash("sha256")
    .update(bytes)
    .digest("hex");
  if (entityCount !== undefined) {
    manifest.files[fileName].entity_count = entityCount;
  }
  writeJson(manifestPath, manifest);
}

function runAgainstCopy(mutate: (directory: string) => void): {
  output: string;
  status: number | null;
} {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "ggstarrail-reference-")
  );
  const bundleDirectory = path.join(temporaryRoot, "bundle");
  try {
    fs.cpSync(generatedDirectory, bundleDirectory, { recursive: true });
    mutate(bundleDirectory);
    const result = spawnSync(
      process.execPath,
      [validatorPath, "--verify-only", "--source", bundleDirectory],
      { cwd: path.resolve("."), encoding: "utf8" }
    );
    return {
      output: `${result.stdout}${result.stderr}`,
      status: result.status,
    };
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

describe("GIlore reference sync regressions", () => {
  it("accepts the generated audited bundle", () => {
    const result = runAgainstCopy(() => undefined);
    expect(result.status).toBe(0);
    expect(result.output).toContain("93 characters");
    expect(result.output).toContain("184 logical pieces / 742 rarity variants");
  });

  it("rejects member hash drift", () => {
    const result = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const source = fs.readFileSync(filePath, "utf8");
      fs.writeFileSync(filePath, source.replace("characters", "characterx"));
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("characters.json SHA-256 mismatch");
  });

  it("rejects an incomplete catalog even when its member metadata is updated", () => {
    const result = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{ value: unknown[] }>(filePath);
      document.value.pop();
      rewriteMember(directory, "characters.json", document, 92);
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "computed catalog count characters mismatch"
    );
  });

  it("rejects member source-revision drift", () => {
    const result = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{ source_revision: string }>(filePath);
      document.source_revision = "f".repeat(40);
      rewriteMember(directory, "characters.json", document);
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("characters.json source revision mismatch");
  });

  it("rejects cross-locale provenance identity drift", () => {
    const result = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{
        value: Array<{
          name: {
            "zh-CN": { provenance: { source_key: string } };
          };
        }>;
      }>(filePath);
      document.value[0].name["zh-CN"].provenance.source_key = "identity-drift";
      rewriteMember(directory, "characters.json", document);
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("cross-locale source identity drift");
  });

  it("rejects display-description and display-parameter drift", () => {
    const descriptionDrift = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{
        value: Array<{
          skills: Array<{
            display_description: { en: { value: string } };
          }>;
        }>;
      }>(filePath);
      document.value[0].skills[0].display_description.en.value += " drift";
      rewriteMember(directory, "characters.json", document);
    });
    expect(descriptionDrift.status).not.toBe(0);
    expect(descriptionDrift.output).toContain("display description drift");

    const parameterDrift = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{
        value: Array<{
          skills: Array<{
            levels: Array<{ display_parameters: number[] }>;
          }>;
        }>;
      }>(filePath);
      document.value[0].skills[0].levels[0].display_parameters[0] += 1;
      rewriteMember(directory, "characters.json", document);
    });
    expect(parameterDrift.status).not.toBe(0);
    expect(parameterDrift.output).toContain("display parameter drift");
  });

  it("rejects missing required descriptions and dangling item references", () => {
    const missingDescription = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{
        value: Array<{
          skills: Array<{ description: unknown }>;
        }>;
      }>(filePath);
      document.value[0].skills[0].description = null;
      rewriteMember(directory, "characters.json", document);
    });
    expect(missingDescription.status).not.toBe(0);
    expect(missingDescription.output).toContain(
      "skill 100101.description must be an object"
    );

    const danglingCost = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{
        value: Array<{
          promotions: Array<{ costs: Array<{ item_id: string }> }>;
        }>;
      }>(filePath);
      const promotion = document.value
        .flatMap((character) => character.promotions)
        .find((entry) => entry.costs.length > 0);
      if (!promotion) throw new Error("test fixture has no promotion costs");
      promotion.costs[0].item_id = "unknown-progression-item";
      rewriteMember(directory, "characters.json", document);
    });
    expect(danglingCost.status).not.toBe(0);
    expect(danglingCost.output).toContain(
      "references unknown progression item unknown-progression-item"
    );
  });

  it("rejects nested servant, enhancement, and Superimposition relation drift", () => {
    const servantDrift = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{
        value: Array<{
          servants: Array<{
            id: string;
            name: { en: { value: string } };
          }>;
        }>;
      }>(filePath);
      const attachments = document.value.flatMap(
        (character) => character.servants
      );
      const repeated = attachments.filter((servant) => servant.id === "18007");
      if (repeated.length !== 2) {
        throw new Error("test fixture is missing repeated servant 18007");
      }
      repeated[1].name.en.value += " drift";
      rewriteMember(directory, "characters.json", document);
    });
    expect(servantDrift.status).not.toBe(0);
    expect(servantDrift.output).toContain(
      "servant 18007 definition drift across attachments"
    );

    const enhancementDrift = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "characters.json");
      const document = readJson<{
        value: Array<{
          enhancements: Array<{
            skill_changes: Array<{ skill_id: string }>;
          }>;
        }>;
      }>(filePath);
      const enhancement = document.value
        .flatMap((character) => character.enhancements)
        .find((entry) => entry.skill_changes.length > 0);
      if (!enhancement) {
        throw new Error("test fixture has no enhancement skill changes");
      }
      enhancement.skill_changes[0].skill_id = "unknown-enhanced-skill";
      rewriteMember(directory, "characters.json", document);
    });
    expect(enhancementDrift.status).not.toBe(0);
    expect(enhancementDrift.output).toContain("has dangling skill change");

    const superimpositionDrift = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "light_cones.json");
      const document = readJson<{
        value: Array<{
          effect: { superimpositions: Array<{ level: number }> };
        }>;
      }>(filePath);
      document.value[0].effect.superimpositions[0].level = 2;
      rewriteMember(directory, "light_cones.json", document);
    });
    expect(superimpositionDrift.status).not.toBe(0);
    expect(superimpositionDrift.output).toContain(
      "superimpositions must be sequential"
    );
  });

  it("rejects property raw/usable icon identity drift", () => {
    const result = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "property_tables.json");
      const document = readJson<{
        value: {
          properties: Array<{
            icon_path: string;
            usable_icon_path: string | null;
          }>;
        };
      }>(filePath);
      const property = document.value.properties.find(
        (entry) => entry.usable_icon_path !== null
      );
      if (!property)
        throw new Error("test fixture has no usable property icon");
      property.icon_path += ".drift";
      rewriteMember(directory, "property_tables.json", document);
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("usable_icon_path drift");
  });

  it("rejects incomplete expanded progression even with updated member metadata", () => {
    const result = runAgainstCopy((directory) => {
      const filePath = path.join(directory, "progression.json");
      const document = readJson<{ value: { items: unknown[] } }>(filePath);
      document.value.items.pop();
      rewriteMember(directory, "progression.json", document, 637);
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "computed catalog count progression_items mismatch"
    );
  });

  it("rejects unknown schema minors and arbitrary primary source IDs", () => {
    const unsupportedSchema = runAgainstCopy((directory) => {
      const manifestPath = path.join(directory, "manifest.json");
      const manifest = readJson<MutableManifest>(manifestPath);
      manifest.schema_version = "1.2.0";
      writeJson(manifestPath, manifest);
    });
    expect(unsupportedSchema.status).not.toBe(0);
    expect(unsupportedSchema.output).toContain(
      "unsupported schema version 1.2.0"
    );

    const arbitrarySource = runAgainstCopy((directory) => {
      const manifestPath = path.join(directory, "manifest.json");
      const manifest = readJson<MutableManifest>(manifestPath);
      manifest.source.source_id = "unreviewed_source";
      writeJson(manifestPath, manifest);
    });
    expect(arbitrarySource.status).not.toBe(0);
    expect(arbitrarySource.output).toContain(
      "manifest source_id must be turn_based_game_data"
    );
  });

  it("does not mutate a previous output when source validation fails", () => {
    const temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "ggstarrail-publication-")
    );
    const sourceDirectory = path.join(temporaryRoot, "source");
    const outputDirectory = path.join(temporaryRoot, "output");
    try {
      fs.cpSync(generatedDirectory, sourceDirectory, { recursive: true });
      fs.cpSync(generatedDirectory, outputDirectory, { recursive: true });
      const previousManifest = fs.readFileSync(
        path.join(outputDirectory, "manifest.json")
      );
      fs.appendFileSync(path.join(sourceDirectory, "characters.json"), " ");

      const result = spawnSync(
        process.execPath,
        [
          validatorPath,
          "--source",
          sourceDirectory,
          "--output",
          outputDirectory,
        ],
        { cwd: path.resolve("."), encoding: "utf8" }
      );

      expect(result.status).not.toBe(0);
      expect(
        fs.readFileSync(path.join(outputDirectory, "manifest.json"))
      ).toEqual(previousManifest);
    } finally {
      fs.rmSync(temporaryRoot, { force: true, recursive: true });
    }
  });
});
