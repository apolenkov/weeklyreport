import assert from "node:assert/strict";
import test from "node:test";

import {
  type DensityBaseline,
  densityBaselineRatchetViolations,
  parseDensityBaseline,
  validateBaselineRoots,
} from "./baseline-schema.ts";
import type { OwnershipCatalogue } from "./catalogue-schema.ts";
import { DIRECT_FILE_THRESHOLD } from "./constants.ts";
import {
  sourceIdentityOf,
  sourceIdentityViolations,
} from "./source-identity.ts";

export { densityBaselineRatchetViolations } from "./baseline-schema.ts";

const SCRIPTS_DIRECTORY = "scripts";
const PREFLIGHT_DIRECTORY = "e2e/runtime-sweep/preflight";
const FIXTURE_EXCEPTION_REASON = "fixture exception";
const NEW_FIXTURE_EXCEPTION_REASON = "new fixture exception";
const BASELINE_31 = 31;
const BASELINE_32 = 32;
const BASELINE_51 = 51;
const BASELINE_96 = 96;

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

const densityFiles = (count: number): readonly string[] =>
  Array.from(
    { length: count },
    (_, index) => `${SCRIPTS_DIRECTORY}/fixture-${String(index + 1)}.ts`,
  );

const densityBaseline = (
  files: readonly string[],
  boundedFlatExceptions: readonly Record<string, unknown>[] = [],
): DensityBaseline =>
  parseDensityBaseline({
    version: 1,
    threshold: DIRECT_FILE_THRESHOLD,
    sourceIdentity: { scripts: sourceIdentityOf(files, "fixture-tree") },
    directCounts: Object.fromEntries(
      files.length > DIRECT_FILE_THRESHOLD
        ? [[SCRIPTS_DIRECTORY, files.length]]
        : [],
    ),
    boundedFlatExceptions,
  });

void test("density baseline history rejects an existing exception raised from 32 to 51", () => {
  const predecessor = densityBaseline(densityFiles(BASELINE_32), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_32,
      reason: FIXTURE_EXCEPTION_REASON,
    },
  ]);
  const changed = densityBaseline(densityFiles(BASELINE_51), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_51,
      reason: FIXTURE_EXCEPTION_REASON,
    },
  ]);

  assert.deepEqual(densityBaselineRatchetViolations(changed, predecessor), [
    `bounded-flat exception increased: ${SCRIPTS_DIRECTORY}=${BASELINE_51} > predecessor ${BASELINE_32}`,
  ]);
});

void test("density baseline history rejects adding a 96-file exception", () => {
  const predecessor = densityBaseline(densityFiles(BASELINE_31), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_31,
      reason: FIXTURE_EXCEPTION_REASON,
    },
  ]);
  const changed = densityBaseline(densityFiles(BASELINE_31), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_31,
      reason: FIXTURE_EXCEPTION_REASON,
    },
    {
      directory: PREFLIGHT_DIRECTORY,
      baseline: BASELINE_96,
      reason: NEW_FIXTURE_EXCEPTION_REASON,
    },
  ]);

  assert.deepEqual(densityBaselineRatchetViolations(changed, predecessor), [
    `bounded-flat exception added without predecessor: ${PREFLIGHT_DIRECTORY}=${BASELINE_96}`,
  ]);
});

void test("density baseline history accepts unchanged and lowered exceptions", () => {
  const predecessor = densityBaseline(densityFiles(BASELINE_51), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_51,
      reason: FIXTURE_EXCEPTION_REASON,
    },
  ]);
  const unchanged = densityBaseline(densityFiles(BASELINE_51), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_51,
      reason: FIXTURE_EXCEPTION_REASON,
    },
  ]);
  const lowered = densityBaseline(densityFiles(BASELINE_32), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_32,
      reason: FIXTURE_EXCEPTION_REASON,
    },
  ]);

  assert.deepEqual(
    densityBaselineRatchetViolations(unchanged, predecessor),
    [],
  );
  assert.deepEqual(densityBaselineRatchetViolations(lowered, predecessor), []);
});

void test("density baseline history fails closed when an exception predecessor is unavailable", () => {
  const baseline = densityBaseline(densityFiles(BASELINE_96), [
    {
      directory: SCRIPTS_DIRECTORY,
      baseline: BASELINE_96,
      reason: FIXTURE_EXCEPTION_REASON,
    },
  ]);

  assert.deepEqual(densityBaselineRatchetViolations(baseline), [
    `bounded-flat exception predecessor unavailable: ${SCRIPTS_DIRECTORY}=${BASELINE_96}`,
  ]);
});
