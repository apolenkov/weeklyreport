import type { CatalogueRoot } from "./catalogue-schema.ts";
import { DIRECT_FILE_THRESHOLD } from "./constants.ts";

const DENSITY_BASELINE_VERSION = 1 as const;

export interface SourceIdentity {
  readonly gitTree: string;
  readonly pathDigest: string;
  readonly trackedFiles: number;
}

interface BoundedFlatException {
  readonly directory: string;
  readonly baseline: number;
  readonly reason: string;
}

export interface DensityBaseline {
  readonly version: typeof DENSITY_BASELINE_VERSION;
  readonly threshold: typeof DIRECT_FILE_THRESHOLD;
  readonly sourceIdentity: Readonly<Record<string, SourceIdentity>>;
  readonly directCounts: Readonly<Record<string, number>>;
  readonly boundedFlatExceptions: readonly BoundedFlatException[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (
  record: Record<string, unknown>,
  key: string,
): string => {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`Invalid density baseline ${key}`);
  return value;
};

const requireNonNegativeInteger = (
  record: Record<string, unknown>,
  key: string,
): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new Error(`Invalid density baseline ${key}`);
  return value;
};

const parseSourceIdentity = (value: unknown, root: string): SourceIdentity => {
  if (!isRecord(value)) throw new Error(`Invalid source identity for ${root}`);
  return {
    gitTree: requireString(value, "gitTree"),
    pathDigest: requireString(value, "pathDigest"),
    trackedFiles: requireNonNegativeInteger(value, "trackedFiles"),
  };
};

const parseExceptions = (value: unknown): readonly BoundedFlatException[] => {
  if (!Array.isArray(value))
    throw new Error("Invalid density baseline boundedFlatExceptions");
  return value.map((entry, index) => {
    if (!isRecord(entry))
      throw new Error(`Invalid bounded-flat exception at ${index}`);
    const directory = requireString(entry, "directory");
    if (directory !== "." && directory.endsWith("/"))
      throw new Error(`Invalid bounded-flat exception directory ${directory}`);
    return {
      directory,
      baseline: requireNonNegativeInteger(entry, "baseline"),
      reason: requireString(entry, "reason"),
    };
  });
};

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

export const parseDensityBaseline = (value: unknown): DensityBaseline => {
  if (!isRecord(value)) throw new Error("Invalid density baseline");
  if (value.version !== DENSITY_BASELINE_VERSION)
    throw new Error("Unsupported density baseline version");
  if (value.threshold !== DIRECT_FILE_THRESHOLD)
    throw new Error(
      `Density baseline threshold must be exactly ${DIRECT_FILE_THRESHOLD}`,
    );

  const sourceIdentityValue = value.sourceIdentity;
  if (!isRecord(sourceIdentityValue))
    throw new Error("Invalid density baseline sourceIdentity");
  const sourceIdentity = Object.fromEntries(
    Object.entries(sourceIdentityValue).map(([root, identity]) => [
      root,
      parseSourceIdentity(identity, root),
    ]),
  );

  const directCountsValue = value.directCounts;
  if (!isRecord(directCountsValue))
    throw new Error("Invalid density baseline directCounts");
  const directCounts = Object.fromEntries(
    Object.entries(directCountsValue).map(([directory, count]) => {
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0)
        throw new Error(`Invalid density baseline count for ${directory}`);
      return [directory, count];
    }),
  );

  const boundedFlatExceptions = parseExceptions(value.boundedFlatExceptions);
  const duplicateExceptions = duplicateValues(
    boundedFlatExceptions.map((entry) => entry.directory),
  );
  if (duplicateExceptions.length > 0)
    throw new Error(
      `Duplicate bounded-flat exceptions: ${duplicateExceptions.join(", ")}`,
    );

  return {
    version: 1,
    threshold: DIRECT_FILE_THRESHOLD,
    sourceIdentity,
    directCounts,
    boundedFlatExceptions,
  };
};

const boundedFlatExceptionMap = (
  baseline: DensityBaseline,
): ReadonlyMap<string, number> =>
  new Map(
    baseline.boundedFlatExceptions.map((entry) => [
      entry.directory,
      entry.baseline,
    ]),
  );

/**
 * Compare a changed structural baseline with its accepted predecessor.
 *
 * The current-tree check proves that stored values describe the checked tree.
 * This second check proves that editing those values cannot legalize a larger
 * flat directory or introduce a new exception by itself. Exception baselines
 * may stay unchanged or decrease, but a new exception requires an architecture
 * decision outside this JSON file.
 */
export const densityBaselineRatchetViolations = (
  baseline: DensityBaseline,
  predecessor?: DensityBaseline,
): readonly string[] => {
  if (predecessor === undefined)
    return baseline.boundedFlatExceptions
      .map(
        (entry) =>
          `bounded-flat exception predecessor unavailable: ${entry.directory}=${entry.baseline}`,
      )
      .toSorted((left, right) => left.localeCompare(right));

  const currentExceptions = boundedFlatExceptionMap(baseline);
  const predecessorExceptions = boundedFlatExceptionMap(predecessor);

  return [
    ...[...currentExceptions.keys()]
      .filter((directory) => !predecessorExceptions.has(directory))
      .toSorted((left, right) => left.localeCompare(right))
      .map(
        (directory) =>
          `bounded-flat exception added without predecessor: ${directory}=${currentExceptions.get(directory) ?? 0}`,
      ),
    ...[...currentExceptions.keys()]
      .filter((directory) => {
        const current = currentExceptions.get(directory);
        const previous = predecessorExceptions.get(directory);
        return (
          current !== undefined && previous !== undefined && current > previous
        );
      })
      .toSorted((left, right) => left.localeCompare(right))
      .map((directory) => {
        const current = currentExceptions.get(directory) ?? 0;
        const previous = predecessorExceptions.get(directory) ?? 0;
        return `bounded-flat exception increased: ${directory}=${current} > predecessor ${previous}`;
      }),
  ];
};

export const validateBaselineRoots = (
  baseline: DensityBaseline,
  roots: readonly CatalogueRoot[],
): readonly string[] => {
  const rootKeys = new Set(roots.map((root) => root.prefix.replace(/\/$/, "")));
  return [
    ...Object.keys(baseline.sourceIdentity)
      .filter((root) => !rootKeys.has(root))
      .map((root) => `baseline has stale source root: ${root}`),
    ...roots
      .filter(
        (root) =>
          baseline.sourceIdentity[root.prefix.replace(/\/$/, "")] === undefined,
      )
      .map(
        (root) =>
          `baseline is missing source root: ${root.prefix.replace(/\/$/, "")}`,
      ),
  ];
};
