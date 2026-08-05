import { readFileSync } from "node:fs";
import { posix } from "node:path";

import { resolveRepoPath } from "../../shared/repo-root.ts";
import { typescriptImportSpecifiers } from "./typescript-import-specifiers.ts";

const WEB_FEATURES_PREFIX = "apps/web/src/features/";
const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/u;

export interface WebFeatureBoundaryViolation {
  readonly file: string;
  readonly specifier: string;
  readonly target: string;
}

export type WebFeatureSourceReader = (file: string) => string;

const readRepositorySource: WebFeatureSourceReader = (file) =>
  readFileSync(resolveRepoPath(file), "utf8");

const featureTarget = (
  target: string,
): { readonly feature: string; readonly parts: readonly string[] } | null => {
  const normalized = posix.normalize(target);
  if (!normalized.startsWith(WEB_FEATURES_PREFIX)) return null;
  const [feature, ...parts] = normalized
    .slice(WEB_FEATURES_PREFIX.length)
    .split("/");
  return feature === undefined || feature === "" ? null : { feature, parts };
};

const sourceFeature = (file: string): string | undefined =>
  featureTarget(file)?.feature;

const resolvedTarget = (file: string, specifier: string): string =>
  posix
    .normalize(posix.join(posix.dirname(file), specifier))
    .replace(SOURCE_EXTENSION, "");

const isFacade = (parts: readonly string[]): boolean =>
  parts.length === 0 || (parts.length === 1 && parts[0] === "index");

const compareViolations = (
  left: WebFeatureBoundaryViolation,
  right: WebFeatureBoundaryViolation,
): number =>
  `${left.file}\u0000${left.specifier}\u0000${left.target}`.localeCompare(
    `${right.file}\u0000${right.specifier}\u0000${right.target}`,
  );

export const formatWebFeatureBoundaryViolation = (
  violation: WebFeatureBoundaryViolation,
): string =>
  `${violation.file}: web feature boundary violation: import "${violation.specifier}" resolves to ${violation.target}; use the sibling feature facade.`;

export function findWebFeatureBoundaryViolations(
  files: readonly string[],
  readSource: WebFeatureSourceReader = readRepositorySource,
): readonly WebFeatureBoundaryViolation[] {
  return files
    .filter(
      (file) => file.startsWith(WEB_FEATURES_PREFIX) && SOURCE_FILE.test(file),
    )
    .flatMap((file) => {
      const ownFeature = sourceFeature(file);
      if (ownFeature === undefined) return [];
      return typescriptImportSpecifiers(file, readSource(file)).flatMap(
        (specifier) => {
          if (!specifier.startsWith(".")) return [];
          const target = resolvedTarget(file, specifier);
          const parsedTarget = featureTarget(target);
          if (
            parsedTarget === null ||
            parsedTarget.feature === ownFeature ||
            isFacade(parsedTarget.parts)
          ) {
            return [];
          }
          return [{ file, specifier, target }];
        },
      );
    })
    .toSorted(compareViolations);
}
