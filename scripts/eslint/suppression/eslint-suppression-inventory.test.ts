import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  readSuppressionInventory,
  readSuppressionInventoryAtCommit,
  withoutLocalGitEnvironment,
} from "./eslint-suppression-inventory.ts";

const fixtureDir = mkdtempSync(path.join(tmpdir(), "suppression-inventory-"));
after(() => rmSync(fixtureDir, { force: true, recursive: true }));

const runFixtureGit = (
  repository: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): string =>
  execFileSync("/usr/bin/git", args, {
    cwd: repository,
    encoding: "utf8",
    env: withoutLocalGitEnvironment(environment),
  });

const commitFixture = (
  repository: string,
  environment: NodeJS.ProcessEnv = process.env,
): void => {
  runFixtureGit(repository, ["init", "--quiet"], environment);
  writeFileSync(
    path.join(repository, "clean.ts"),
    "export const clean = true;\n",
  );
  runFixtureGit(repository, ["add", "clean.ts"], environment);
  runFixtureGit(
    repository,
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    environment,
  );
};

const fixture = (name: string, source: string): string => {
  const file = path.join(fixtureDir, name);
  writeFileSync(file, source);
  return file;
};

void test("counts directive comments but not strings or explanatory mentions", () => {
  const file = fixture(
    "sample.ts",
    [
      'const text = "eslint-disable-next-line no-alert";',
      "// Inline eslint-disable is forbidden here",
      "// eslint-disable-next-line no-alert -- browser fixture",
      "alert(text);",
    ].join("\n"),
  );

  const inventory = readSuppressionInventory([file]);

  assert.equal(inventory.rawMatches, 3);
  assert.equal(inventory.directives.length, 1);
  assert.equal(inventory.noise.length, 2);
  const [directive] = inventory.directives;
  assert.ok(directive);
  assert.equal(directive.rule, "no-alert");
  assert.equal(directive.scope, "next-line");
  assert.equal(directive.target, "alert(text);");
});

void test("splits a multi-rule directive into independently owned records", () => {
  const file = fixture(
    "multi.ts",
    [
      "/* eslint-disable no-alert, no-console -- generated boundary */",
      "alert('x');",
    ].join("\n"),
  );

  const inventory = readSuppressionInventory([file]);

  assert.deepEqual(
    inventory.directives.map((entry) => entry.rule),
    ["no-alert", "no-console"],
  );
  assert.ok(inventory.directives.every((entry) => entry.scope === "file"));
});

void test("a commit with zero suppression matches returns an empty inventory", () => {
  const repository = mkdtempSync(path.join(tmpdir(), "suppression-git-"));
  commitFixture(repository);

  assert.deepEqual(readSuppressionInventoryAtCommit("HEAD", repository), {
    rawMatches: 0,
    directives: [],
    noise: [],
  });
});

void test("fixture commits ignore Git-hook repository environment", () => {
  const parent = mkdtempSync(path.join(tmpdir(), "suppression-parent-git-"));
  const fixtureRepository = mkdtempSync(
    path.join(tmpdir(), "suppression-child-git-"),
  );
  commitFixture(parent);
  const parentHead = runFixtureGit(parent, ["rev-parse", "HEAD"]).trim();
  const poisonedEnvironment = {
    ...process.env,
    GIT_DIR: path.join(parent, ".git"),
    GIT_INDEX_FILE: path.join(parent, ".git", "index"),
    GIT_WORK_TREE: parent,
  };

  commitFixture(fixtureRepository, poisonedEnvironment);

  assert.equal(runFixtureGit(parent, ["rev-parse", "HEAD"]).trim(), parentHead);
  assert.equal(
    realpathSync(
      runFixtureGit(fixtureRepository, ["rev-parse", "--show-toplevel"]).trim(),
    ),
    realpathSync(fixtureRepository),
  );
  assert.equal(
    runFixtureGit(fixtureRepository, ["show", "HEAD:clean.ts"]),
    "export const clean = true;\n",
  );
});
