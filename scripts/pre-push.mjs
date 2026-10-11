import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function runPrePush(run = spawnSync, updates = "") {
  const branchCommits = updates
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter(
      ([, sha, remoteRef]) =>
        remoteRef?.startsWith("refs/heads/") && !/^0+$/.test(sha)
    )
    .map(([, sha]) => sha);
  if (branchCommits.length) {
    const head = run("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
    if (head.error || head.status !== 0) return head.status || 1;
    if (branchCommits.some((sha) => sha !== head.stdout.trim())) {
      console.error(
        "Pre-push validation must run from the commit being pushed. Switch to that branch and retry."
      );
      return 1;
    }
  }
  const status = run("git", ["status", "--porcelain"], { encoding: "utf8" });
  if (status.error || status.status !== 0) return status.status || 1;
  if (status.stdout.trim()) {
    console.error(
      "Pre-push validation requires a clean tree so it checks committed code. Commit or finish pending work first."
    );
    return 1;
  }
  for (const [command, args] of [
    ["git", ["diff", "--check"]],
    [process.platform === "win32" ? "npm.cmd" : "npm", ["run", "check"]],
  ]) {
    const result = run(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32" && command === "npm.cmd",
    });
    if (result.error || result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runPrePush(spawnSync, readFileSync(0, "utf8"));
}
