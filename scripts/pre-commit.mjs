import { pathToFileURL } from "node:url";
import { runGate } from "./run-gate.mjs";

export function runPreCommit(run = runGate) {
  const staged = run(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { encoding: "utf8" }
  );
  if (staged.error || staged.status !== 0) return staged.status || 1;
  const files = staged.stdout.split("\0").filter(Boolean);
  const pending = run("git", ["diff", "--name-only", "-z"], {
    encoding: "utf8",
  });
  if (pending.error || pending.status !== 0) return pending.status || 1;
  if (pending.stdout.split("\0").some((file) => files.includes(file))) {
    console.error(
      "Commit blocked: staged files have additional unstaged changes. Finish those files before validating them."
    );
    return 1;
  }
  const commands = [
    ["git", ["diff", "--cached", "--check"]],
    ["npm", ["run", "lint"]],
    ["npm", ["run", "type-check"]],
    ["npm", ["run", "depcheck"]],
    ["npm", ["run", "test:tooling"]],
    [
      "node",
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "tests/i18n.test.tsx",
        "tests/ui-invariants.test.ts",
      ],
    ],
  ];
  const changedTs = files.filter(
    (file) =>
      /\.(ts|tsx)$/.test(file) &&
      !file.startsWith("worker/") &&
      !file.startsWith("tests/worker/")
  );
  if (changedTs.length)
    commands.push([
      "node",
      [
        "node_modules/vitest/vitest.mjs",
        "related",
        "--run",
        "--passWithNoTests",
        ...changedTs,
      ],
    ]);
  if (
    files.some((file) =>
      /^(worker\/|tests\/worker\/|wrangler\.jsonc$|vitest\.worker\.config\.ts$|tsconfig\.worker\.json$|package(-lock)?\.json$)/.test(
        file
      )
    )
  ) {
    commands.push(["npm", ["run", "check:worker"]]);
  }
  for (const [command, args] of commands) {
    const result = run(command, args, { stdio: "inherit" });
    if (result.error || result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runPreCommit();
}
