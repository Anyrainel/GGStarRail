import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("dependency-cruiser rejects representative forbidden imports", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const config = structuredClone(
    createRequire(import.meta.url)("../.dependency-cruiser.cjs")
  );
  config.options.tsConfig.fileName = path.join(root, "tsconfig.app.json");
  const cwd = mkdtempSync(path.join(tmpdir(), "ggstarrail-deps-"));
  const write = (name, source) => {
    const target = path.join(cwd, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  };
  try {
    write(
      ".dependency-cruiser.cjs",
      `module.exports = ${JSON.stringify(config)};`
    );
    write("src/domain/kit.ts", 'import "react/jsx-runtime";');
    write(
      "node_modules/react/package.json",
      '{"name":"react","exports":{"./jsx-runtime":"./jsx-runtime.js"}}'
    );
    write("node_modules/react/jsx-runtime.js", "export const jsx = () => {};");
    write(
      "src/ui.ts",
      'import "node:child_process"; import "../tests/helper.js"; import "./missing.js";'
    );
    write("tests/helper.js", "export const fixture = true;");
    write("worker/index.ts", 'import "../src/ui.ts";');
    const result = spawnSync(
      process.execPath,
      [
        path.join(
          root,
          "node_modules/dependency-cruiser/bin/dependency-cruise.mjs"
        ),
        "src",
        "worker",
        "--config",
        ".dependency-cruiser.cjs",
        "--output-type",
        "err",
      ],
      { cwd, encoding: "utf8" }
    );
    assert.ok(result.status > 0, result.stderr + result.stdout);
    const violations = result.stdout;
    for (const rule of [
      "domain-is-framework-free",
      "browser-has-no-node-builtins",
      "production-has-no-test-dependencies",
      "no-unresolved-imports",
      "worker-is-standalone",
    ])
      assert.ok(violations.includes(rule), `Missing violation: ${rule}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
