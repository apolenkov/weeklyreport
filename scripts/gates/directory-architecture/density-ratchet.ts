import {
  type DensityBaseline,
  parseDensityBaseline,
  validateBaselineRoots,
} from "./baseline-schema.ts";
import type { OwnershipCatalogue } from "./catalogue-schema.ts";
import { DIRECT_FILE_THRESHOLD } from "./constants.ts";
import { sourceIdentityViolations } from "./source-identity.ts";

interface DensityMeasurement {
  readonly directory: string;
  readonly directFiles: number;
}

export interface DensityValidation {
  readonly measurements: readonly DensityMeasurement[];
  readonly overThreshold: readonly DensityMeasurement[];
  readonly unexplained: readonly DensityMeasurement[];
  readonly regressedExceptions: readonly DensityMeasurement[];
  readonly directCountViolations: readonly string[];
  readonly baselineViolations: readonly string[];
  readonly errors: readonly string[];
}

const parentOf = (file: string): string => {
  const index = file.lastIndexOf("/");
  return index === -1 ? "." : file.slice(0, index);
};

export const directFileCounts = (
  files: readonly string[],
): Readonly<Record<string, number>> =>
  Object.fromEntries(
    [
      ...files
        .map((file) => parentOf(file.replaceAll("\\", "/")))
        .reduce<Map<string, number>>(
          (counts, directory) =>
            counts.set(directory, (counts.get(directory) ?? 0) + 1),
          new Map(),
        ),
    ].sort(([left], [right]) => left.localeCompare(right)),
  );

const measurementsOf = (
  files: readonly string[],
): readonly DensityMeasurement[] =>
  Object.entries(directFileCounts(files)).map(([directory, directFiles]) => ({
    directory,
    directFiles,
  }));

const acceptedExceptions = (
  baseline: DensityBaseline,
): ReadonlyMap<string, number> =>
  new Map(
    baseline.boundedFlatExceptions.map((entry) => [
      entry.directory,
      entry.baseline,
    ]),
  );

const directCountsAboveThreshold = (
  counts: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> =>
  Object.fromEntries(
    Object.entries(counts).filter(
      ([, directFiles]) => directFiles > DIRECT_FILE_THRESHOLD,
    ),
  );

const directCountViolations = (
  baseline: Readonly<Record<string, number>>,
  current: Readonly<Record<string, number>>,
): readonly string[] =>
  [
    ...Object.keys(baseline)
      .filter((directory) => current[directory] === undefined)
      .map(
        (directory) =>
          `baseline directCounts has stale directory: ${directory}`,
      ),
    ...Object.keys(current)
      .filter((directory) => baseline[directory] === undefined)
      .map(
        (directory) =>
          `baseline directCounts is missing directory: ${directory}`,
      ),
    ...Object.keys(baseline)
      .filter(
        (directory) =>
          current[directory] !== undefined &&
          current[directory] !== baseline[directory],
      )
      .flatMap((directory) => {
        const baselineCount = baseline[directory];
        const currentCount = current[directory];
        return baselineCount === undefined || currentCount === undefined
          ? []
          : [
              `baseline directCounts count drift: ${directory}=${baselineCount} != ${currentCount}`,
            ];
      }),
  ].toSorted((left, right) => left.localeCompare(right));

export const validateDensity = (
  files: readonly string[],
  catalogue: OwnershipCatalogue,
  baselineValue: unknown,
  currentSourceIdentity?: DensityBaseline["sourceIdentity"],
): DensityValidation => {
  const baseline = parseDensityBaseline(baselineValue);
  const measurements = measurementsOf(files);
  const currentDirectCounts = directCountsAboveThreshold(
    directFileCounts(files),
  );
  const overThreshold = measurements.filter(
    (measurement) => measurement.directFiles > DIRECT_FILE_THRESHOLD,
  );
  const exceptions = acceptedExceptions(baseline);
  const unexplained = overThreshold.filter(
    (measurement) => !exceptions.has(measurement.directory),
  );
  const regressedExceptions = overThreshold.filter((measurement) => {
    const exceptionBaseline = exceptions.get(measurement.directory);
    return (
      exceptionBaseline !== undefined &&
      measurement.directFiles > exceptionBaseline
    );
  });
  const sourceViolations =
    currentSourceIdentity === undefined
      ? []
      : sourceIdentityViolations(
          baseline.sourceIdentity,
          currentSourceIdentity,
        );
  const baselineViolations = [
    ...sourceViolations,
    ...validateBaselineRoots(baseline, catalogue.roots),
  ];
  const directCountViolationsValue = directCountViolations(
    baseline.directCounts,
    currentDirectCounts,
  );
  const errors = [
    ...baselineViolations,
    ...directCountViolationsValue,
    ...unexplained.map(
      ({ directory, directFiles }) =>
        `directory exceeds ${DIRECT_FILE_THRESHOLD} direct files without bounded-flat exception: ${directory}=${directFiles}`,
    ),
    ...regressedExceptions.map(
      ({ directory, directFiles }) =>
        `bounded-flat exception increased: ${directory}=${directFiles} > ${exceptions.get(directory) ?? 0}`,
    ),
  ];
  return {
    measurements,
    overThreshold,
    unexplained,
    regressedExceptions,
    directCountViolations: directCountViolationsValue,
    baselineViolations,
    errors,
  };
};

export const densityPasses = (validation: DensityValidation): boolean =>
  validation.errors.length === 0;
