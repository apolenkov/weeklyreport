import { readFileSync } from "node:fs";
import { posix } from "node:path";

import { resolveRepoPath } from "../../shared/repo-root.ts";
import { typescriptImportSpecifiers } from "./typescript-import-specifiers.ts";

const API_MODULES_PREFIX = "apps/api/src/modules/";
const API_TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/u;

export interface ApiTestBoundaryViolation {
  readonly file: string;
  readonly specifier: string;
  readonly target: string;
}

export type ApiTestSourceReader = (file: string) => string;

const readRepositorySource: ApiTestSourceReader = (file) =>
  readFileSync(resolveRepoPath(file), "utf8");

const moduleNameFor = (file: string): string | undefined => {
  const normalized = posix.normalize(file);
  if (!normalized.startsWith(API_MODULES_PREFIX)) return undefined;
  const moduleName = normalized.slice(API_MODULES_PREFIX.length).split("/")[0];
  return moduleName === "" ? undefined : moduleName;
};

const resolvedTargetFor = (file: string, specifier: string): string =>
  posix
    .normalize(posix.join(posix.dirname(file), specifier))
    .replace(SOURCE_EXTENSION, "");

const targetModuleAndParts = (
  target: string,
): {
  readonly moduleName: string;
  readonly parts: readonly string[];
} | null => {
  const normalized = posix.normalize(target);
  if (!normalized.startsWith(API_MODULES_PREFIX)) return null;
  const [moduleName, ...parts] = normalized
    .slice(API_MODULES_PREFIX.length)
    .split("/");
  return moduleName === undefined || moduleName === ""
    ? null
    : { moduleName, parts };
};

const isAllowedSiblingTarget = (parts: readonly string[]): boolean =>
  (parts.length === 1 && parts[0] === "index") ||
  (parts.length === 2 && parts[0] === "test-seams" && parts[1] === "index");

const compareViolations = (
  left: ApiTestBoundaryViolation,
  right: ApiTestBoundaryViolation,
): number =>
  `${left.file}\u0000${left.specifier}\u0000${left.target}`.localeCompare(
    `${right.file}\u0000${right.specifier}\u0000${right.target}`,
  );

export const formatApiTestBoundaryViolation = (
  violation: ApiTestBoundaryViolation,
): string =>
  `${violation.file}: API test boundary violation: import "${violation.specifier}" resolves to ${violation.target}; use the sibling index.ts facade or test-seams/index.ts seam.`;

export function findApiTestBoundaryViolations(
  files: readonly string[],
  readSource: ApiTestSourceReader = readRepositorySource,
): readonly ApiTestBoundaryViolation[] {
  return files
    .filter((file) => API_TEST_FILE.test(file))
    .flatMap((file) => {
      const sourceModule = moduleNameFor(file);
      if (sourceModule === undefined) return [];
      return typescriptImportSpecifiers(file, readSource(file)).flatMap(
        (specifier) => {
          if (!specifier.startsWith(".")) return [];
          const target = resolvedTargetFor(file, specifier);
          const targetParts = targetModuleAndParts(target);
          if (
            targetParts === null ||
            targetParts.moduleName === sourceModule ||
            isAllowedSiblingTarget(targetParts.parts)
          ) {
            return [];
          }
          return [{ file, specifier, target }];
        },
      );
    })
    .toSorted(compareViolations);
}
