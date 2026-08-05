import { createHash } from "node:crypto";

import type { SourceIdentity } from "./baseline-schema.ts";

const SHA256 = "sha256";

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
