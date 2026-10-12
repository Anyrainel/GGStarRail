import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

it("keeps executable source under an explicit architecture owner", () => {
  const directories = new Set([
    "app",
    "config",
    "domain",
    "providers",
    "services",
    "lib",
    "stores",
    "contexts",
    "hooks",
    "i18n",
    "components",
    "pages",
    "content",
    "data",
    "generated",
    "presets",
  ]);
  const unowned = readdirSync(path.join(root, "src"), { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory()
        ? !directories.has(entry.name)
        : !["main.tsx", "index.css", "vite-env.d.ts"].includes(entry.name)
    )
    .map((entry) => entry.name);
  expect(unowned).toEqual([]);
});

it("keeps executable catalog loaders out of generated data folders", () => {
  const code: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(tsx?|[cm]?js)$/.test(entry.name))
        code.push(path.relative(root, file));
    }
  };
  walk(path.join(root, "src/data"));
  expect(code).toEqual([]);
});
