import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "customreport";
const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const assertRepositoryRoot = (candidate: string): string => {
  const packageJsonPath = resolve(candidate, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    readonly name?: unknown;
  };
  if (packageJson.name !== PACKAGE_NAME) {
    throw new Error(
      `Expected ${PACKAGE_NAME} repository root, received ${dirname(packageJsonPath)}`,
    );
  }
  return candidate;
};

export const REPO_ROOT = assertRepositoryRoot(root);

export const resolveRepoPath = (...segments: readonly string[]): string =>
  resolve(REPO_ROOT, ...segments);
