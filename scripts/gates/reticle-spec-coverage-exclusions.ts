import { readFile } from "node:fs/promises";

import { isSafeReticleSegment } from "./reticle-flow-validation.ts";
import { validateExclusionDecisionReference } from "./reticle-proof-validation.ts";
import type {
  ReticleExcludedOutcome,
  ReticleExcludedSpec,
  ReticleSpecCoverageExclusions,
} from "./reticle-spec-coverage-types.ts";
import type { OpenSpecScenario } from "./reticle-spec-inventory.ts";

const EXCLUSIONS_VERSION = 1;

export interface ExcludedEntryIdentity {
  readonly spec: unknown;
  readonly requirement: unknown;
  readonly scenario: unknown;
  readonly ordinal: unknown;
}

export interface ResolvedExclusions {
  readonly minimumMandatoryOutcomes: number;
  isExcludedSpec(spec: unknown): boolean;
  isExcludedEntry(identity: ExcludedEntryIdentity): boolean;
}

const NO_EXCLUSIONS: ResolvedExclusions = {
  minimumMandatoryOutcomes: 0,
  isExcludedSpec: () => false,
  isExcludedEntry: () => false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function outcomeKey(identity: ExcludedEntryIdentity): string | undefined {
  if (
    typeof identity.spec !== "string" ||
    typeof identity.requirement !== "string" ||
    typeof identity.scenario !== "string" ||
    !Number.isSafeInteger(identity.ordinal)
  ) {
    return undefined;
  }
  return JSON.stringify([
    identity.spec,
    identity.requirement,
    identity.scenario,
    identity.ordinal,
  ]);
}

/** Reads the identity fields an exclusion declaration can name. */
export function excludedEntryIdentity(entry: unknown): ExcludedEntryIdentity {
  if (!isRecord(entry)) {
    return {
      spec: undefined,
      requirement: undefined,
      scenario: undefined,
      ordinal: undefined,
    };
  }
  const outcome = entry.outcome;
  return {
    spec: entry.spec,
    requirement: entry.requirement,
    scenario: entry.scenario,
    ordinal: isRecord(outcome) ? outcome.ordinal : undefined,
  };
}

function parseExcludedSpecs(value: unknown): void {
  if (!isRecord(value)) throw new Error("invalid excluded specification list");
  for (const declared of Object.values(value)) {
    if (
      !isRecord(declared) ||
      !isNonEmptyString(declared.reason) ||
      !Number.isSafeInteger(declared.outcomes) ||
      (declared.outcomes as number) < 1
    ) {
      throw new Error("invalid excluded specification");
    }
  }
}

function parseExcludedOutcomes(value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("invalid excluded outcome list");
  for (const declared of value) {
    if (
      !isRecord(declared) ||
      !isNonEmptyString(declared.spec) ||
      !isNonEmptyString(declared.requirement) ||
      !isNonEmptyString(declared.scenario) ||
      !Number.isSafeInteger(declared.ordinal) ||
      !isNonEmptyString(declared.reason)
    ) {
      throw new Error("invalid excluded outcome");
    }
  }
}

function parseExclusions(value: unknown): ReticleSpecCoverageExclusions {
  if (
    !isRecord(value) ||
    value.version !== EXCLUSIONS_VERSION ||
    !isSafeReticleSegment(value.projectId) ||
    !isRecord(value.decision) ||
    !isNonEmptyString(value.decision.date) ||
    !isNonEmptyString(value.decision.reference) ||
    !isNonEmptyString(value.decision.detail) ||
    !Number.isSafeInteger(value.decision.minimumMandatoryOutcomes) ||
    (value.decision.minimumMandatoryOutcomes as number) < 1
  ) {
    throw new Error("invalid Reticle specification coverage exclusions");
  }
  parseExcludedSpecs(value.excludedSpecs);
  parseExcludedOutcomes(value.excludedOutcomes);
  // SAFETY: every field read above is type-checked, so the parsed declaration
  // already matches the interface and only its static type is missing.
  return value as unknown as ReticleSpecCoverageExclusions;
}

export async function readReticleSpecCoverageExclusions(
  path: string | undefined,
): Promise<ReticleSpecCoverageExclusions | undefined> {
  if (path === undefined) return undefined;
  try {
    return parseExclusions(JSON.parse(await readFile(path, "utf8")) as unknown);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    if (error instanceof SyntaxError)
      throw new Error("invalid Reticle specification coverage exclusions");
    throw error;
  }
}

function inventoryKeys(inventory: readonly OpenSpecScenario[]): Set<string> {
  const keys = new Set<string>();
  for (const scenario of inventory) {
    for (const outcome of scenario.outcomes) {
      const key = outcomeKey({
        spec: scenario.spec,
        requirement: scenario.requirement,
        scenario: scenario.scenario,
        ordinal: outcome.ordinal,
      });
      if (key !== undefined) keys.add(key);
    }
  }
  return keys;
}

function specOutcomeCounts(
  inventory: readonly OpenSpecScenario[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const scenario of inventory) {
    counts.set(
      scenario.spec,
      (counts.get(scenario.spec) ?? 0) + scenario.outcomes.length,
    );
  }
  return counts;
}

function assertExcludedSpecsResolve(
  excludedSpecs: Readonly<Record<string, ReticleExcludedSpec>>,
  counts: ReadonlyMap<string, number>,
): void {
  for (const [spec, declared] of Object.entries(excludedSpecs)) {
    const derived = counts.get(spec);
    if (derived === undefined)
      throw new Error(`unknown excluded specification: ${spec}`);
    if (declared.outcomes !== derived) {
      throw new Error(
        `excluded specification outcome count changed: ${spec} declares ${declared.outcomes} but the corpus has ${derived}`,
      );
    }
  }
}

function resolveDeclaredOutcomes(
  declaredOutcomes: readonly ReticleExcludedOutcome[],
  known: ReadonlySet<string>,
): Set<string> {
  const keys = new Set<string>();
  for (const declared of declaredOutcomes) {
    const key = outcomeKey({
      spec: declared.spec,
      requirement: declared.requirement,
      scenario: declared.scenario,
      ordinal: declared.ordinal,
    });
    if (key === undefined || !known.has(key))
      throw new Error(`unknown excluded outcome: ${JSON.stringify(declared)}`);
    if (keys.has(key)) throw new Error(`duplicate excluded outcome: ${key}`);
    keys.add(key);
  }
  return keys;
}

/**
 * Resolves which outcomes stay outside mandatory coverage. An absent or empty
 * declaration keeps every outcome mandatory, so coverage can only shrink
 * through an explicit, reviewed record rather than by omission.
 */
export async function resolveExclusions(
  exclusions: ReticleSpecCoverageExclusions | undefined,
  inventory: readonly OpenSpecScenario[],
  projectId: string,
): Promise<ResolvedExclusions> {
  if (exclusions === undefined) return NO_EXCLUSIONS;
  if (exclusions.projectId !== projectId)
    throw new Error("exclusions projectId mismatch");
  await validateExclusionDecisionReference(exclusions.decision.reference);
  assertExcludedSpecsResolve(
    exclusions.excludedSpecs,
    specOutcomeCounts(inventory),
  );
  const declaredKeys = resolveDeclaredOutcomes(
    exclusions.excludedOutcomes ?? [],
    inventoryKeys(inventory),
  );
  const isExcludedSpec = (spec: unknown): boolean =>
    typeof spec === "string" && Object.hasOwn(exclusions.excludedSpecs, spec);
  return {
    minimumMandatoryOutcomes: exclusions.decision.minimumMandatoryOutcomes,
    isExcludedSpec,
    isExcludedEntry: (identity) => {
      if (isExcludedSpec(identity.spec)) return true;
      const key = outcomeKey(identity);
      return key !== undefined && declaredKeys.has(key);
    },
  };
}
