import type {
  CatalogueRoot,
  OwnershipCatalogue,
  OwnershipRule,
} from "./catalogue-schema.ts";
import { cataloguePathError, targetPathError } from "./catalogue-schema.ts";

interface OwnershipMatch {
  readonly file: string;
  readonly ruleId: string;
  readonly scope: string;
  readonly concern: string;
  readonly role: OwnershipRule["role"];
  readonly target: string;
}

export interface CatalogueValidation {
  readonly matches: readonly OwnershipMatch[];
  readonly missingOwners: readonly string[];
  readonly duplicateOwners: readonly string[];
  readonly duplicateTargets: readonly string[];
  readonly staleRules: readonly string[];
  readonly staleRoots: readonly string[];
  readonly invalidPaths: readonly string[];
  readonly invalidTargets: readonly string[];
  readonly errors: readonly string[];
}

const normalized = (file: string): string => file.replaceAll("\\", "/");

const rootForFile = (
  file: string,
  roots: readonly CatalogueRoot[],
): CatalogueRoot | undefined =>
  roots.find((root) => {
    if (!file.startsWith(root.prefix)) return false;
    return root.includePattern === undefined
      ? true
      : new RegExp(root.includePattern).test(file);
  });

const matchingRules = (
  file: string,
  catalogue: OwnershipCatalogue,
): readonly OwnershipRule[] =>
  catalogue.rules.filter(
    (rule) =>
      rule.scope === rootForFile(file, catalogue.roots)?.id &&
      new RegExp(rule.pattern).test(file),
  );

const targetFor = (file: string, rule: OwnershipRule): string => {
  const match = new RegExp(rule.pattern).exec(file);
  if (match === null)
    throw new Error(`Ownership rule ${rule.id} does not match ${file}`);
  return file.replace(new RegExp(rule.pattern), rule.target);
};

const ruleMatches = (
  files: readonly string[],
  catalogue: OwnershipCatalogue,
): ReadonlyMap<string, readonly string[]> =>
  new Map(
    catalogue.rules.map((rule) => [
      rule.id,
      files.filter((file) =>
        rule.scope === rootForFile(file, catalogue.roots)?.id
          ? new RegExp(rule.pattern).test(file)
          : false,
      ),
    ]),
  );

export const validateOwnership = (
  files: readonly string[],
  catalogue: OwnershipCatalogue,
): CatalogueValidation => {
  const normalizedFiles = [...new Set(files.map(normalized))].toSorted(
    (left, right) => left.localeCompare(right),
  );
  const invalidPaths = normalizedFiles
    .flatMap((file) => {
      const error = cataloguePathError(file);
      return error === undefined
        ? []
        : [`invalid catalogue path: ${file} ${error}`];
    })
    .toSorted((left, right) => left.localeCompare(right));
  const scopedFiles = normalizedFiles.filter(
    (file) =>
      cataloguePathError(file) === undefined &&
      catalogue.roots.some((root) => rootForFile(file, [root]) !== undefined),
  );
  const matches = scopedFiles.flatMap((file) =>
    matchingRules(file, catalogue).map((rule) => ({
      file,
      ruleId: rule.id,
      scope: rule.scope,
      concern: rule.concern,
      role: rule.role,
      target: targetFor(file, rule),
    })),
  );
  const matchesByFile = Map.groupBy(matches, (match) => match.file);
  const missingOwners = scopedFiles.filter(
    (file) => (matchesByFile.get(file)?.length ?? 0) === 0,
  );
  const duplicateOwners = [...matchesByFile]
    .filter(([, fileMatches]) => fileMatches.length > 1)
    .map(([file]) => file)
    .sort((left, right) => left.localeCompare(right));
  const targetByValue = Map.groupBy(matches, (match) => match.target);
  const duplicateTargets = [...targetByValue]
    .filter(([, targetMatches]) => {
      const filesForTarget = new Set(targetMatches.map((match) => match.file));
      return filesForTarget.size > 1;
    })
    .map(([target]) => target)
    .sort((left, right) => left.localeCompare(right));
  const invalidTargets = matches
    .flatMap((match) => {
      const root = catalogue.roots.find(
        (candidate) => candidate.id === match.scope,
      );
      const error =
        root === undefined
          ? "has no declared root"
          : targetPathError(match.target, root);
      return error === undefined
        ? []
        : [`invalid target path: ${match.ruleId} -> ${match.target} ${error}`];
    })
    .toSorted((left, right) => left.localeCompare(right));
  const matchesByRule = ruleMatches(scopedFiles, catalogue);
  const staleRules = catalogue.rules
    .filter(
      (rule) =>
        !rule.optional && (matchesByRule.get(rule.id)?.length ?? 0) === 0,
    )
    .map((rule) => rule.id)
    .sort((left, right) => left.localeCompare(right));
  const staleRoots = catalogue.roots
    .filter((root) => !scopedFiles.some((file) => rootForFile(file, [root])))
    .map((root) => root.id)
    .sort((left, right) => left.localeCompare(right));
  const errors = [
    ...invalidPaths,
    ...invalidTargets,
    ...missingOwners.map((file) => `missing ownership rule: ${file}`),
    ...duplicateOwners.map((file) => `multiple ownership rules: ${file}`),
    ...duplicateTargets.map((target) => `duplicate target path: ${target}`),
    ...staleRules.map((rule) => `stale ownership rule: ${rule}`),
    ...staleRoots.map((root) => `stale ownership root: ${root}`),
  ];
  return {
    matches,
    missingOwners,
    duplicateOwners,
    duplicateTargets,
    staleRules,
    staleRoots,
    invalidPaths,
    invalidTargets,
    errors,
  };
};

export const ownershipPasses = (validation: CatalogueValidation): boolean =>
  validation.errors.length === 0;
