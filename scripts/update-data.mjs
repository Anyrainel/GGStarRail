import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const producer = path.resolve(
  process.env.GILORE_ROOT ?? path.join(root, "../GIlore")
);
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
// Producer checks source/schema coverage before exporting. Consumer checks
// remain strict: a new schema or audited revision requires a reviewed update.
run("uv", ["run", "python", "-m", "hsr_data", "reference", "--pull"], producer);
run("uv", ["run", "python", "-m", "hsr_data", "assets", "--pull"], producer);
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
run(process.execPath, ["scripts/prepare-web-assets.mjs"]);
run(process.execPath, ["scripts/data-bundle.mjs", "package"]);
