import { spawnSync } from "node:child_process";
import path from "node:path";
import { crawlHoyolab } from "./hoyolab.mjs";
import { crawlNanoka } from "./nanoka.mjs";
import { publishSourceAssets } from "./source-assets.mjs";

const root = path.resolve(import.meta.dirname, "..");
const producer = path.resolve(
  process.env.GILORE_ROOT ?? path.join(root, "../GIlore")
);
const args = new Set(process.argv.slice(2));
if (
  [...args].some(
    (arg) =>
      ![
        "--cached",
        "--package",
        "--legacy-cache",
        "--genshin",
        "--help",
      ].includes(arg)
  )
)
  throw new Error("Unknown option; run node scripts/update-data.mjs --help");
if (args.has("--help")) {
  console.log(
    "node scripts/update-data.mjs [--cached] [--genshin] [--legacy-cache] [--package]\nUpdates GIlore reference, HoYoWiki official evidence/images, Nanoka beta previews/images, and split website files. --cached uses existing validated snapshots. --genshin also runs GIlore's existing direct GenshinTools exporter. --legacy-cache updates the separately audited fallback reference/PNG cache. --package includes that audit and creates a release archive/lock requiring publication before push."
  );
  process.exit(0);
}
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
}
// Current website data is guarded by GIlore's schema/source coverage. The legacy
// reference/PNG cache is independently pinned and is only a fallback image source.
const pull = args.has("--cached") ? [] : ["--pull"];
run("uv", ["run", "python", "-m", "hsr_data", "reference", ...pull], producer);
if (args.has("--legacy-cache") || args.has("--package")) {
  run("uv", ["run", "python", "-m", "hsr_data", "assets", ...pull], producer);
  run(process.execPath, [
    "scripts/sync-hsr-reference.mjs",
    "--source",
    path.join(producer, "data/reference/honkai_star_rail/v1"),
  ]);
  run(process.execPath, [
    "scripts/sync-hsr-assets.mjs",
    "--source",
    path.join(producer, "data/reference/honkai_star_rail/assets/v1"),
  ]);
}
const referenceRoot = path.join(producer, "data/reference/honkai_star_rail/v1");
const evidencePath = path.join(
  producer,
  "data/raw/honkai_star_rail/hoyolab.json"
);
const nanokaRoot = path.join(producer, "data/raw/honkai_star_rail/nanoka");
if (!args.has("--cached")) {
  await crawlHoyolab({ referenceRoot, output: evidencePath });
  await crawlNanoka({ evidencePath, outputRoot: nanokaRoot });
}
run(
  "uv",
  [
    "run",
    "python",
    "-m",
    "hsr_data.website_export",
    "--reference-root",
    referenceRoot,
    "--evidence",
    evidencePath,
    "--nanoka-root",
    nanokaRoot,
    "--website-root",
    root,
  ],
  producer
);
if (!args.has("--cached")) await publishSourceAssets(nanokaRoot, evidencePath);
run(process.execPath, ["scripts/prepare-web-assets.mjs"]);
run(process.execPath, ["scripts/check-game-data.mjs"]);
if (args.has("--genshin"))
  run(
    "uv",
    ["run", "python", "-m", "anime_game_data", "reference", ...pull],
    producer
  );
if (args.has("--package"))
  run(process.execPath, ["scripts/data-bundle.mjs", "package"]);
