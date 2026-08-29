import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { REPO_ROOT, resolveRepoPath } from "../../shared/repo-root.ts";
import type { MarkdownSource } from "./repository-path-references.ts";

const GIT = "/usr/bin/git";
const DURABLE_SPEC = /^openspec\/specs\/[^/]+\/spec\.md$/u;

export const isScannedMarkdown = (path: string): boolean =>
  path === "README.md" ||
  (path.startsWith("docs/") && path.endsWith(".md")) ||
  DURABLE_SPEC.test(path);

export const existingRepositoryInventory = (
  inventory: readonly string[],
  pathExists: (path: string) => boolean,
): readonly string[] => inventory.filter(pathExists);

const repositoryInventory = (): readonly string[] =>
  existingRepositoryInventory(
    execFileSync(
      GIT,
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    )
      .split("\0")
      .filter((path) => path.length > 0),
    (path) => existsSync(resolveRepoPath(path)),
  );

const REPOSITORY_INVENTORY = repositoryInventory();

export const repositoryPathExistsInInventory = (
  path: string,
  inventory: readonly string[],
): boolean => {
  const directoryPrefix = `${path.replace(/\/$/u, "")}/`;
  return (
    inventory.includes(path) ||
    inventory.some((candidate) => candidate.startsWith(directoryPrefix))
  );
};

export const readTrackedMarkdownSources = (): readonly MarkdownSource[] =>
  REPOSITORY_INVENTORY.filter(isScannedMarkdown)
    .toSorted((left, right) => left.localeCompare(right))
    .map((path) => ({
      path,
      content: readFileSync(resolveRepoPath(path), "utf8"),
    }));

export const repositoryPathExists = (path: string): boolean =>
  repositoryPathExistsInInventory(path, REPOSITORY_INVENTORY);
