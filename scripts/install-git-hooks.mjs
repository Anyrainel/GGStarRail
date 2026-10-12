import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function installGitHooks(cwd = process.cwd()) {
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (result.error) throw result.error;
    return result;
  };
  if (git("rev-parse", "--git-dir").status !== 0) return;
  const current = git("config", "--get", "core.hooksPath");
  if (current.status === 0 && current.stdout.trim() !== ".githooks") {
    throw new Error(
      `Existing core.hooksPath (${current.stdout.trim()}) must be reconciled with .githooks; refusing to replace it.`
    );
  }
  const result = git("config", "--local", "core.hooksPath", ".githooks");
  if (result.status !== 0) throw new Error(result.stderr);
  console.log("GGStarRail commit and push validation installed.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  installGitHooks();
}
