import {
  isReticleAssertion,
  isSafeReticleSegment,
  type ReticleAssertion,
} from "./reticle-flow-validation.ts";
import type {
  OpenSpecOutcome,
  OpenSpecScenario,
} from "./reticle-spec-inventory.ts";

export type DeterministicEvidenceSurface =
  | "server-test"
  | "database-test"
  | "deployment-check"
  | "static-source-gate"
  | "performance-check"
  | "operations-check"
  | "non-web-client-test";

export interface ReticleProof {
  kind: "reticle";
  flow: string;
  assertion: ReticleAssertion;
  consequence: string;
}

export interface DeterministicProof {
  kind: "deterministic";
  surface: DeterministicEvidenceSurface;
  reference: string;
  detail: string;
}

export type CoverageProof = ReticleProof | DeterministicProof;

export type ReticleCoverage =
  | { kind: "unclassified" }
  | {
      kind: "classified";
      proofs: [CoverageProof, ...CoverageProof[]];
    };

export interface ReticleSpecCoverageEntry {
  spec: string;
  requirement: string;
  scenario: string;
  fingerprint: string;
  outcome: OpenSpecOutcome;
  coverage: ReticleCoverage;
}

export interface ReticleSpecCoverageRegistry {
  version: 2;
  projectId: string;
  scenarios: ReticleSpecCoverageEntry[];
}

export interface ReticleSpecCoverageDecision {
  readonly date: string;
  readonly reference: string;
  readonly detail: string;
  readonly minimumMandatoryOutcomes: number;
}

/**
 * Declares the owner-signed outcomes that stay outside mandatory coverage.
 * Every specification absent from `excludedSpecs` remains mandatory, so a new
 * or unlisted specification fails closed instead of being silently skipped.
 */
export interface ReticleExcludedOutcome {
  readonly spec: string;
  readonly requirement: string;
  readonly scenario: string;
  readonly ordinal: number;
  readonly reason: string;
}

/**
 * Declares the owner-signed outcomes that stay outside mandatory coverage.
 * Every outcome not named here remains mandatory, so a new or unlisted outcome
 * fails closed instead of being silently skipped.
 */
export interface ReticleExcludedSpec {
  readonly reason: string;
  /** Outcome count the declaration retired; corpus growth must fail the gate. */
  readonly outcomes: number;
}

/**
 * Declares the owner-signed outcomes that stay outside mandatory coverage.
 * Every outcome not named here remains mandatory, so a new or unlisted outcome
 * fails closed instead of being silently skipped.
 */
export interface ReticleSpecCoverageExclusions {
  readonly version: 1;
  readonly projectId: string;
  readonly decision: ReticleSpecCoverageDecision;
  readonly excludedSpecs: Readonly<Record<string, ReticleExcludedSpec>>;
  readonly excludedOutcomes?: readonly ReticleExcludedOutcome[];
}

export interface ReticleSpecCoveragePaths {
  readonly specsRoot: string;
  readonly registryPath: string;
  readonly flowsRoot: string;
  readonly projectId: string;
  readonly exclusionsPath?: string;
}

export interface ReticleSpecCoverageSummary {
  readonly scenarios: number;
  readonly outcomes: number;
  readonly reticleOutcomes: number;
  readonly deterministicOutcomes: number;
  readonly mixedOutcomes: number;
  readonly totalProofs: number;
  readonly unclassifiedOutcomes: number;
  readonly excludedOutcomes: number;
  readonly excludedProofs: number;
  readonly mandatoryOutcomes: number;
  readonly flows: number;
}

const DETERMINISTIC_SURFACES = new Set<DeterministicEvidenceSurface>([
  "server-test",
  "database-test",
  "deployment-check",
  "static-source-gate",
  "performance-check",
  "operations-check",
  "non-web-client-test",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function coverageProofError(value: unknown): string | null {
  if (!isRecord(value) || typeof value.kind !== "string")
    return "invalid proof";
  if (value.kind === "reticle") {
    return hasExactlyKeys(value, [
      "kind",
      "flow",
      "assertion",
      "consequence",
    ]) &&
      isSafeReticleSegment(value.flow) &&
      isReticleAssertion(value.assertion) &&
      nonEmptyString(value.consequence)
      ? null
      : "invalid Reticle mapping";
  }
  if (value.kind !== "deterministic") return "invalid proof";
  if (!hasExactlyKeys(value, ["kind", "surface", "reference", "detail"]))
    return "invalid deterministic proof";
  if (
    typeof value.surface !== "string" ||
    !DETERMINISTIC_SURFACES.has(value.surface as DeterministicEvidenceSurface)
  )
    return "invalid deterministic surface";
  if (!nonEmptyString(value.reference))
    return "invalid deterministic reference";
  return nonEmptyString(value.detail) ? null : "invalid deterministic detail";
}

export function isCoverageProof(value: unknown): value is CoverageProof {
  return coverageProofError(value) === null;
}

export function preservedCoverage(
  prior: ReticleSpecCoverageEntry | undefined,
  scenario: OpenSpecScenario,
  outcome: OpenSpecOutcome,
): ReticleSpecCoverageEntry["coverage"] {
  if (prior === undefined) return { kind: "unclassified" };
  const unchanged =
    prior.fingerprint === scenario.fingerprint &&
    prior.outcome.fingerprint === outcome.fingerprint &&
    prior.outcome.keyword === outcome.keyword &&
    prior.outcome.text === outcome.text;
  return unchanged ? prior.coverage : { kind: "unclassified" };
}
