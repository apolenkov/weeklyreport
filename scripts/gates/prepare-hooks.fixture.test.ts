import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const { scripts } = JSON.parse(
  readFileSync(resolve("package.json"), "utf8"),
) as {
  scripts: { prepare: string };
};

void test("prepare preserves permanent-checkout hook ownership", async (t) => {
  mkdirSync(resolve("output"), { recursive: true });
  const fixture = mkdtempSync(resolve("output/prepare-hooks-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const main = join(fixture, "main");
  const linked = join(fixture, "linked");
  const nongit = join(fixture, "nongit");
  const bin = join(fixture, "bin");
  const template = join(fixture, "template");
  const log = join(fixture, "installer.log");
  for (const directory of [main, nongit, bin, template]) mkdirSync(directory);
  // Hooks can export GIT_DIR and friends; fixtures must never inherit that target.
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    ),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TEMPLATE_DIR: template,
    GIT_CEILING_DIRECTORIES: fixture,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    WR_TEST_PREPARE_LOG: log,
  };
  const git = (args: string[]) => {
    const result = spawnSync("/usr/bin/git", args, {
      cwd: main,
      env,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
  };
  git(["init", "--quiet"]);
  git([
    "-c",
    "user.name=Prepare Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "fixture",
  ]);
  git(["worktree", "add", "--detach", "--quiet", linked]);
  const subdirectory = join(main, "subdirectory");
  mkdirSync(subdirectory);
  writeFileSync(
    join(bin, "lefthook"),
    String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$WR_TEST_PREPARE_LOG"
printf 'fixture installer output\n' >&2
exit "$WR_TEST_PREPARE_STATUS"
`,
    { mode: 0o700 },
  );

  for (const [name, cwd, installerStatus, calls, missingGit] of [
    ["main checkout installs", main, 0, "install\n", false],
    ["main subdirectory installs", subdirectory, 0, "install\n", false],
    ["main installer failure propagates", main, 23, "install\n", false],
    ["linked worktree skips installer", linked, 0, "", false],
    ["no-Git directory skips installer", nongit, 0, "", false],
    ["missing Git skips installer", nongit, 0, "", true],
  ] as const) {
    await t.test(name, () => {
      writeFileSync(log, "");
      const result = spawnSync("/bin/sh", ["-c", scripts.prepare], {
        cwd,
        env: {
          ...env,
          PATH: missingGit ? bin : env.PATH,
          WR_TEST_PREPARE_STATUS: String(installerStatus),
        },
        encoding: "utf8",
        timeout: 5000,
      });
      t.diagnostic(
        `${name}: runner=${process.pid} child=${result.pid} status=${String(result.status)}`,
      );
      assert.equal(result.status, installerStatus, result.stderr);
      assert.equal(readFileSync(log, "utf8"), calls);
      if (calls) assert.match(result.stderr, /fixture installer output/u);
      if (cwd === linked)
        assert.match(result.stdout, /skip.*linked worktree/iu);
    });
  }
});
