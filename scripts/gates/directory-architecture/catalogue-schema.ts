import { DIRECT_FILE_THRESHOLD } from "./constants.ts";

const OWNERSHIP_CATALOGUE_VERSION = 1 as const;

const CATALOGUE_ROLES = [
  "entrypoint",
  "implementation",
  "test",
  "fixture",
  "data",
  "config",
  "facade",
] as const;

type CatalogueRole = (typeof CATALOGUE_ROLES)[number];

export interface CatalogueRoot {
  readonly id: string;
  readonly prefix: string;
  readonly allowedTargetPrefixes: readonly string[];
  readonly allowedTargets: readonly string[];
  readonly includePattern?: string;
}

export interface OwnershipRule {
  readonly id: string;
  readonly scope: string;
  readonly pattern: string;
  readonly concern: string;
  readonly role: CatalogueRole;
  readonly target: string;
  readonly optional?: boolean;
}

export interface OwnershipCatalogue {
  readonly version: typeof OWNERSHIP_CATALOGUE_VERSION;
  readonly threshold: typeof DIRECT_FILE_THRESHOLD;
  readonly roots: readonly CatalogueRoot[];
  readonly rules: readonly OwnershipRule[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (
  record: Record<string, unknown>,
  key: string,
): string => {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ownership catalogue ${key}`);
  }
  return value;
};

const requireArray = (value: unknown, key: string): readonly unknown[] => {
  if (!Array.isArray(value))
    throw new Error(`Invalid ownership catalogue ${key}`);
  return value;
};

export const cataloguePathError = (path: string): string | undefined => {
  const normalizedPath = path.replaceAll("\\", "/");
  if (normalizedPath.startsWith("/") || /^[A-Za-z]:\//.test(normalizedPath))
    return "must be repository-relative";
  if (normalizedPath.split("/").includes(".."))
    return "must not contain '..' path segments";
  return undefined;
};

export const targetPathError = (
  target: string,
  root: CatalogueRoot,
): string | undefined => {
  const pathViolation = cataloguePathError(target);
  if (pathViolation !== undefined) return pathViolation;
  const normalizedTarget = target.replaceAll("\\", "/");
  return root.allowedTargets.includes(normalizedTarget) ||
    root.allowedTargetPrefixes.some((prefix) =>
      normalizedTarget.startsWith(prefix),
    )
    ? undefined
    : "outside allowed target homes";
};

const requireRepositoryPath = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`Invalid ${label}`);
  const error = cataloguePathError(value);
  if (error !== undefined) throw new Error(`${label} ${error}`);
  return value;
};

const compilePattern = (pattern: string, label: string): RegExp => {
  if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
    throw new Error(`${label} must be anchored with ^ and $`);
  }
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new Error(
      `${label} is not a valid regular expression: ${String(error)}`,
    );
  }
};

const isCatalogueRole = (value: string): value is CatalogueRole =>
  (CATALOGUE_ROLES as readonly string[]).includes(value);

const duplicateValues = (values: readonly string[]): readonly string[] => {
  const counts = values.reduce<Map<string, number>>(
    (result, value) => result.set(value, (result.get(value) ?? 0) + 1),
    new Map(),
  );
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((left, right) => left.localeCompare(right));
};

const parseRoot = (value: unknown, index: number): CatalogueRoot => {
  if (!isRecord(value)) throw new Error(`Invalid ownership root at ${index}`);
  const prefix = requireRepositoryPath(
    value.prefix,
    `ownership root at ${index} prefix`,
  );
  if (!prefix.endsWith("/"))
    throw new Error(`Ownership root ${prefix} must end with /`);
  const allowedTargetPrefixes = requireArray(
    value.allowedTargetPrefixes,
    `root ${prefix} allowedTargetPrefixes`,
  ).map((targetPrefix, targetIndex) => {
    const parsedPrefix = requireRepositoryPath(
      targetPrefix,
      `ownership root ${prefix} allowedTargetPrefixes[${targetIndex}]`,
    );
    if (!parsedPrefix.endsWith("/"))
      throw new Error(
        `Ownership root ${prefix} allowed target prefix ${parsedPrefix} must end with /`,
      );
    return parsedPrefix;
  });
  if (allowedTargetPrefixes.length === 0)
    throw new Error(
      `Ownership root ${prefix} must declare allowed target prefixes`,
    );
  const allowedTargets = (
    value.allowedTargets === undefined
      ? []
      : requireArray(value.allowedTargets, `root ${prefix} allowedTargets`)
  ).map((target, targetIndex) => {
    const parsedTarget = requireRepositoryPath(
      target,
      `ownership root ${prefix} allowedTargets[${targetIndex}]`,
    );
    if (parsedTarget.endsWith("/"))
      throw new Error(
        `Ownership root ${prefix} exact target ${parsedTarget} must not end with /`,
      );
    return parsedTarget;
  });
  const includePattern = value.includePattern;
  if (includePattern !== undefined) {
    if (typeof includePattern !== "string")
      throw new Error(`Invalid ownership root includePattern at ${index}`);
    compilePattern(includePattern, `ownership root ${prefix} includePattern`);
  }
  return {
    id: requireString(value, "id"),
    prefix,
    allowedTargetPrefixes,
    allowedTargets,
    ...(includePattern === undefined ? {} : { includePattern }),
  };
};

const parseRule = (
  value: unknown,
  index: number,
  roots: ReadonlyMap<string, CatalogueRoot>,
): OwnershipRule => {
  if (!isRecord(value)) throw new Error(`Invalid ownership rule at ${index}`);
  const pattern = requireString(value, "pattern");
  compilePattern(pattern, `ownership rule ${index} pattern`);
  const scope = requireString(value, "scope");
  const root = roots.get(scope);
  if (root === undefined)
    throw new Error(`Ownership rule ${scope} has no declared root`);
  const role = requireString(value, "role");
  if (!isCatalogueRole(role))
    throw new Error(`Ownership rule ${scope} has invalid role ${role}`);
  const optional = value.optional;
  if (optional !== undefined && typeof optional !== "boolean")
    throw new Error(`Ownership rule ${scope} optional must be boolean`);
  const target = requireRepositoryPath(
    value.target,
    `ownership rule ${scope} target`,
  );
  const targetError = targetPathError(target, root);
  if (targetError !== undefined)
    throw new Error(`Ownership rule ${scope} target ${target} ${targetError}`);
  return {
    id: requireString(value, "id"),
    scope,
    pattern,
    concern: requireString(value, "concern"),
    role,
    target,
    ...(optional === undefined ? {} : { optional }),
  };
};

export const parseOwnershipCatalogue = (value: unknown): OwnershipCatalogue => {
  if (!isRecord(value)) throw new Error("Invalid ownership catalogue");
  if (value.version !== OWNERSHIP_CATALOGUE_VERSION)
    throw new Error("Unsupported ownership catalogue version");
  if (value.threshold !== DIRECT_FILE_THRESHOLD)
    throw new Error(
      `Ownership catalogue threshold must be exactly ${DIRECT_FILE_THRESHOLD}`,
    );

  const roots = requireArray(value.roots, "roots").map(parseRoot);
  const duplicateRoots = duplicateValues(roots.map((root) => root.id));
  if (duplicateRoots.length > 0)
    throw new Error(`Duplicate ownership roots: ${duplicateRoots.join(", ")}`);

  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const rules = requireArray(value.rules, "rules").map((rule, index) =>
    parseRule(rule, index, rootsById),
  );
  const duplicateRules = duplicateValues(rules.map((rule) => rule.id));
  if (duplicateRules.length > 0)
    throw new Error(`Duplicate ownership rules: ${duplicateRules.join(", ")}`);

  const prefixes = roots.map((root) => root.prefix);
  const duplicatePrefixes = duplicateValues(prefixes);
  if (duplicatePrefixes.length > 0)
    throw new Error(
      `Duplicate ownership root prefixes: ${duplicatePrefixes.join(", ")}`,
    );

  return {
    version: OWNERSHIP_CATALOGUE_VERSION,
    threshold: DIRECT_FILE_THRESHOLD,
    roots,
    rules,
  };
};
