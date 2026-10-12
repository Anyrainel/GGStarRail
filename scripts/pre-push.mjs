import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runGate } from "./run-gate.mjs";

export function runPrePush(run = runGate, updates = "") {
  const initialHead = run("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (initialHead.error || initialHead.status !== 0)
    return initialHead.status || 1;
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
    if (branchCommits.some((sha) => sha !== initialHead.stdout.trim())) {
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
    ["npm", ["run", "check"]],
  ]) {
    const result = run(command, args, {
      stdio: "inherit",
    });
    if (result.error || result.status !== 0) return result.status || 1;
  }
  const finalHead = run("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (finalHead.error || finalHead.status !== 0) return finalHead.status || 1;
  const finalStatus = run("git", ["status", "--porcelain"], {
    encoding: "utf8",
  });
  if (finalStatus.error || finalStatus.status !== 0)
    return finalStatus.status || 1;
  if (
    finalHead.stdout.trim() !== initialHead.stdout.trim() ||
    finalStatus.stdout.trim()
  ) {
    console.error(
      "Push blocked: the commit or working tree changed during validation. Retry from a clean checkout."
    );
    return 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runPrePush(runGate, readFileSync(0, "utf8"));
}
