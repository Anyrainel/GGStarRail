import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { installGitHooks } from "./install-git-hooks.mjs";
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
        ["status", "--porcelain"],
        ["diff", "--check"],
        ["run", "check"],
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
      runPrePush(() => {
        calls++;
        return status;
      }),
      1
    );
    assert.equal(calls, 1);
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
  assert.deepEqual(calls.at(-1), ["run", "check"]);
});
