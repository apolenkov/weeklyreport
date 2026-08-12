import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { REPO_ROOT } from "../../shared/repo-root.ts";
import {
  type DensityBaseline,
  parseDensityBaseline,
  type SourceIdentity,
} from "./baseline-schema.ts";

const SHA256 = "sha256";
const BASELINE_RELATIVE_PATH =
  "scripts/gates/directory-architecture/directory-architecture-baseline.json";
const GIT_BIN = "/usr/bin/git";

const normalizedPaths = (files: readonly string[]): readonly string[] =>
  [...new Set(files.map((file) => file.replaceAll("\\", "/")))].toSorted(
    (left, right) => left.localeCompare(right),
  );

export const pathDigest = (files: readonly string[]): string =>
  createHash(SHA256)
    .update(`${normalizedPaths(files).join("\n")}\n`)
    .digest("hex");

export const sourceIdentityOf = (
  files: readonly string[],
  gitTree: string,
): SourceIdentity => ({
  gitTree,
  pathDigest: pathDigest(files),
  trackedFiles: normalizedPaths(files).length,
});

export const sourceIdentityViolations = (
  expected: Readonly<Record<string, SourceIdentity>>,
  actual: Readonly<Record<string, SourceIdentity>>,
): readonly string[] =>
  [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .toSorted((left, right) => left.localeCompare(right))
    .flatMap((root) => {
      const expectedIdentity = expected[root];
      const actualIdentity = actual[root];
      if (expectedIdentity === undefined)
        return [`source identity has an un-baselined root: ${root}`];
      if (actualIdentity === undefined)
        return [`source identity is missing current root: ${root}`];
      return expectedIdentity.pathDigest === actualIdentity.pathDigest &&
        expectedIdentity.trackedFiles === actualIdentity.trackedFiles
        ? []
        : [
            `stale structural baseline for ${root}: ` +
              `expected tree=${expectedIdentity.gitTree} ` +
              `paths=${expectedIdentity.pathDigest} ` +
              `files=${expectedIdentity.trackedFiles}; ` +
              `actual tree=${actualIdentity.gitTree} ` +
              `paths=${actualIdentity.pathDigest} ` +
              `files=${actualIdentity.trackedFiles}`,
          ];
    });

const git = (args: readonly string[]): string =>
  execFileSync(GIT_BIN, [...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: Number.MAX_SAFE_INTEGER,
  });

const baselineAt = (revision: string): DensityBaseline | undefined => {
  const pathInTree = git([
    "ls-tree",
    "--name-only",
    revision,
    "--",
    BASELINE_RELATIVE_PATH,
  ]).trim();
  return pathInTree === ""
    ? undefined
    : parseDensityBaseline(
        JSON.parse(
          git(["show", `${revision}:${BASELINE_RELATIVE_PATH}`]),
        ) as unknown,
      );
};

const baselineComparisonRevision = (env: NodeJS.ProcessEnv): string => {
  const explicitBase =
    env.DIRECTORY_ARCHITECTURE_BASE_SHA ?? env.GITHUB_BASE_SHA;
  if (explicitBase !== undefined) {
    const baseSha = explicitBase.trim();
    if (!/^[0-9a-f]{7,64}$/iu.test(baseSha))
      throw new Error(
        "Directory architecture base SHA must be a hexadecimal commit SHA; refusing to skip baseline history",
      );
    const resolvedBase = git([
      "rev-parse",
      "--verify",
      `${baseSha}^{commit}`,
    ]).trim();
    if (resolvedBase === "")
      throw new Error(
        "Directory architecture base SHA resolved to an empty commit; refusing to skip baseline history",
      );
    return resolvedBase;
  }

  // A dirty worktree is the local predecessor: staged and unstaged baseline
  // edits are compared to HEAD. Clean checkouts (including CI) compare the
  // checked commit with its first parent. Both references are local Git
  // objects; no remote lookup or implicit fetch may turn a missing base into a
  // false pass.
  return git(["status", "--porcelain=v1", "--untracked-files=all"]).trim() ===
    ""
    ? "HEAD^"
    : "HEAD";
};

export const predecessorBaseline = (
  env: NodeJS.ProcessEnv = process.env,
): DensityBaseline | undefined => baselineAt(baselineComparisonRevision(env));

export const currentBaseline = (path: string): DensityBaseline =>
  parseDensityBaseline(JSON.parse(readFileSync(path, "utf8")) as unknown);
