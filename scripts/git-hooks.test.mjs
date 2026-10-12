import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { installGitHooks } from "./install-git-hooks.mjs";
import { runPreCommit } from "./pre-commit.mjs";
import { runPrePush } from "./pre-push.mjs";

test("installs hooks in fresh clones, is idempotent, and preserves custom hooks", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "ggstarrail-hooks-"));
  const git = (...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
  try {
    assert.equal(git("init", "-q").status, 0);
    installGitHooks(cwd);
    installGitHooks(cwd);
    assert.equal(
      git("config", "--get", "core.hooksPath").stdout.trim(),
      ".githooks"
    );
    assert.equal(git("config", "core.hooksPath", ".custom-hooks").status, 0);
    assert.throws(() => installGitHooks(cwd), /refusing to replace/);
    assert.equal(
      git("config", "--get", "core.hooksPath").stdout.trim(),
      ".custom-hooks"
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pre-push runs the complete gate and propagates failures", () => {
  for (const exitCode of [0, 1, 7]) {
    const calls = [];
    const result = runPrePush((command, args) => {
      calls.push([command, args]);
      return { status: args.includes("check") ? exitCode : 0, stdout: "" };
    });
    assert.equal(result, exitCode);
    assert.deepEqual(
      calls.map(([, args]) => args),
      [
        ["rev-parse", "HEAD"],
        ["status", "--porcelain"],
        ["diff", "--check"],
        ["run", "check"],
        ...(exitCode === 0
          ? [
              ["rev-parse", "HEAD"],
              ["status", "--porcelain"],
            ]
          : []),
      ]
    );
  }
});

test("pre-push blocks dirty trees and failed Git commands before validation", () => {
  for (const status of [
    { status: 0, stdout: " M file" },
    { status: 1, stdout: "" },
  ]) {
    let calls = 0;
    assert.equal(
      runPrePush((_command, args) => {
        calls++;
        if (args.includes("rev-parse")) return { status: 0, stdout: "head" };
        return status;
      }),
      1
    );
    assert.equal(calls, 2);
  }
  let calls = 0;
  assert.equal(
    runPrePush(() => {
      calls++;
      return calls === 1 ? { status: 0, stdout: "" } : { status: 2 };
    }),
    2
  );
  assert.equal(calls, 2);
});

test("pre-push validates the pushed branch commit rather than an unrelated clean checkout", () => {
  const head = "a".repeat(40);
  const other = "b".repeat(40);
  const calls = [];
  const run = (_command, args) => {
    calls.push(args);
    return { status: 0, stdout: args.includes("rev-parse") ? head : "" };
  };
  assert.equal(
    runPrePush(run, `refs/heads/other ${other} refs/heads/main ${head}`),
    1
  );
  assert.equal(calls.length, 1);
  calls.length = 0;
  assert.equal(
    runPrePush(run, `refs/heads/main ${head} refs/heads/main ${other}`),
    0
  );
  assert.ok(calls.some((args) => args.join(" ") === "run check"));
});

test("push blocks edits and new commits made while checks run", () => {
  for (const mutation of ["head", "tree"]) {
    let checked = false;
    const result = runPrePush((_command, args) => {
      if (args.includes("check")) checked = true;
      return {
        status: 0,
        stdout: args.includes("rev-parse")
          ? checked && mutation === "head"
            ? "new"
            : "old"
          : checked && mutation === "tree"
            ? " M file"
            : "",
      };
    });
    assert.equal(result, 1);
  }
});

test("commit gates check related tests, dependency boundaries, conventions and Worker changes", () => {
  const calls = [];
  assert.equal(
    runPreCommit((command, args) => {
      calls.push([command, args]);
      return {
        status: 0,
        stdout:
          args.includes("--cached") && args.includes("-z")
            ? "src/file with spaces.ts\0worker/index.ts\0"
            : "",
      };
    }),
    0
  );
  assert.ok(calls.some(([, args]) => args.join(" ") === "run depcheck"));
  assert.ok(calls.some(([, args]) => args.join(" ") === "run check:worker"));
  assert.ok(
    calls.some(
      ([, args]) =>
        args.includes("tests/contracts/ui-invariants.test.ts") &&
        args.includes("tests/i18n/i18n.test.tsx")
    )
  );
  const related = calls.find(([, args]) => args.includes("related"));
  assert.equal(related[1].at(-1), "src/file with spaces.ts");
});

test("commit gates reject partial staging and propagate check failures without rewriting files", () => {
  let calls = 0;
  assert.equal(
    runPreCommit(() => {
      calls++;
      return { status: 0, stdout: "src/a.ts\0" };
    }),
    1
  );
  assert.equal(calls, 2);
  for (const failingGate of [
    "lint",
    "type-check",
    "depcheck",
    "test:tooling",
    "related",
    "check:worker",
  ]) {
    assert.equal(
      runPreCommit((_command, args) => ({
        status: args.includes(failingGate) ? 7 : 0,
        stdout:
          args.includes("--cached") && args.includes("-z")
            ? "src/a.ts\0worker/index.ts\0"
            : "",
      })),
      7
    );
  }
});
