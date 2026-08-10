import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

import { REPO_ROOT, resolveRepoPath } from "../../shared/repo-root.ts";
import {
  aggregateCheckScripts,
  packageTestReferences,
  readPackageScripts,
  validateRepositoryTestOwnership,
} from "./discovery.ts";
import { REPOSITORY_TEST_MANIFEST } from "./manifest.ts";

const PACKAGE_JSON = resolveRepoPath("package.json");
const LINT_GATE = resolveRepoPath("scripts/gates/orchestrator/lint-gate.ts");
const GIT = "/usr/bin/git";
const NODE_TEST_ARGUMENTS = ["--test", "--test-concurrency=1"] as const;
const PACKAGE_TEST_REFERENCES = packageTestReferences(
  readPackageScripts(PACKAGE_JSON),
);

interface Result {
  readonly owner: string;
  readonly path: string;
  readonly ok: boolean;
  readonly detail: string;
}

const currentScriptTests = (): readonly string[] => {
  const result = spawnSync(
    GIT,
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "scripts",
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || `git exited ${String(result.status)}`);
  const currentTests = result.stdout
    .split("\0")
    .filter((path) => /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(path))
    .filter((path) => existsSync(resolveRepoPath(path)));
  return currentTests;
};

const discovery = (): ReturnType<typeof validateRepositoryTestOwnership> =>
  validateRepositoryTestOwnership({
    currentPaths: currentScriptTests(),
    manifest: REPOSITORY_TEST_MANIFEST,
    packageTestReferences: PACKAGE_TEST_REFERENCES,
    aggregateScripts: aggregateCheckScripts(readFileSync(LINT_GATE, "utf8")),
  });

const runEntry = (entry: (typeof REPOSITORY_TEST_MANIFEST)[number]): Result => {
  const outcome = spawnSync(
    process.execPath,
    [...NODE_TEST_ARGUMENTS, entry.path],
    { cwd: REPO_ROOT, stdio: "inherit" },
  );
  const command = `${basename(process.execPath)} ${[
    ...NODE_TEST_ARGUMENTS,
    entry.path,
  ].join(" ")}`;
  const detail =
    outcome.error !== undefined
      ? `could not start: ${outcome.error.message}`
      : outcome.signal !== null
        ? `killed by ${outcome.signal}`
        : `exit ${String(outcome.status)}`;
  return {
    owner: entry.owner,
    path: entry.path,
    ok:
      outcome.error === undefined &&
      outcome.signal === null &&
      outcome.status === 0,
    detail: `${command} — ${detail}`,
  };
};

const main = (): void => {
  const report = discovery();
  process.stdout.write(
    `repository-test discovery PASS — ${report.currentCount} current tests; ` +
      `${report.manifestCount} manifest-owned; ${report.packageScriptCount} ` +
      "package-script references\n",
  );
  const results = REPOSITORY_TEST_MANIFEST.map(runEntry);
  results.forEach((result) =>
    process.stdout.write(
      `repository-test ${result.ok ? "PASS" : "FAIL"} ` +
        `owner=${result.owner} path=${result.path} ${result.detail}\n`,
    ),
  );
  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) process.exitCode = 1;
  else
    process.stdout.write(
      `repository-test gate PASS — ${results.length} manifest entries executed once\n`,
    );
};

main();
