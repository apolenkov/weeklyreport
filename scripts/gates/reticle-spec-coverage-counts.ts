import { validateEntryCoverage } from "./reticle-proof-validation.ts";
import {
  excludedEntryIdentity,
  type ResolvedExclusions,
} from "./reticle-spec-coverage-exclusions.ts";
import {
  identityKey,
  validateEntryIdentity,
  validateEntryShape,
} from "./reticle-spec-coverage-registry.ts";
import type {
  ReticleSpecCoverageEntry,
  ReticleSpecCoveragePaths,
} from "./reticle-spec-coverage-types.ts";
import type {
  OpenSpecOutcome,
  OpenSpecScenario,
} from "./reticle-spec-inventory.ts";

export interface InventoryOutcome {
  readonly scenario: OpenSpecScenario;
  readonly outcome: OpenSpecOutcome;
}

export interface CoverageCounts {
  readonly reticleOutcomes: number;
  readonly deterministicOutcomes: number;
  readonly mixedOutcomes: number;
  readonly totalProofs: number;
  readonly excludedOutcomes: number;
  readonly excludedProofs: number;
  readonly unclassifiedOutcomes: number;
}

const EMPTY_COUNTS: CoverageCounts = {
  reticleOutcomes: 0,
  deterministicOutcomes: 0,
  mixedOutcomes: 0,
  totalProofs: 0,
  excludedOutcomes: 0,
  excludedProofs: 0,
  unclassifiedOutcomes: 0,
};

interface EntryCoverage {
  readonly hasReticle: boolean;
  readonly hasDeterministic: boolean;
  readonly proofCount: number;
}

function addCoverage(
  counts: CoverageCounts,
  coverage: EntryCoverage,
): CoverageCounts {
  return {
    ...counts,
    reticleOutcomes: counts.reticleOutcomes + (coverage.hasReticle ? 1 : 0),
    deterministicOutcomes:
      counts.deterministicOutcomes + (coverage.hasDeterministic ? 1 : 0),
    mixedOutcomes:
      counts.mixedOutcomes +
      (coverage.hasReticle && coverage.hasDeterministic ? 1 : 0),
    totalProofs: counts.totalProofs + coverage.proofCount,
  };
}

function inspectExcludedCoverage(entry: unknown): {
  readonly unclassified: boolean;
  readonly proofCount: number;
} {
  if (!isRecord(entry) || !isRecord(entry.coverage))
    return { unclassified: false, proofCount: 0 };
  if (entry.coverage.kind === "unclassified")
    return { unclassified: true, proofCount: 0 };
  const proofs = entry.coverage.proofs;
  return {
    unclassified: false,
    proofCount: Array.isArray(proofs) ? proofs.length : 0,
  };
}

function addExcluded(counts: CoverageCounts, entry: unknown): CoverageCounts {
  const coverage = inspectExcludedCoverage(entry);
  return {
    ...counts,
    excludedOutcomes: counts.excludedOutcomes + 1,
    excludedProofs: counts.excludedProofs + coverage.proofCount,
    unclassifiedOutcomes:
      counts.unclassifiedOutcomes + (coverage.unclassified ? 1 : 0),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertEntrySourceMatches(
  entry: ReticleSpecCoverageEntry,
  source: InventoryOutcome,
  key: string,
): void {
  if (source.scenario.fingerprint !== entry.fingerprint)
    throw new Error(`stale scenario fingerprint: ${key}`);
  if (source.outcome.fingerprint !== entry.outcome.fingerprint)
    throw new Error(`stale outcome fingerprint: ${key}`);
  if (
    source.outcome.keyword !== entry.outcome.keyword ||
    source.outcome.text !== entry.outcome.text
  )
    throw new Error(`stale outcome text: ${key}`);
}

function assertEntryIdentityMatchesInventory(
  entry: ReticleSpecCoverageEntry,
  inventoryByIdentity: ReadonlyMap<string, InventoryOutcome>,
  seen: Set<string>,
): void {
  const key = identityKey(entry);
  if (seen.has(key)) throw new Error(`duplicate registry entry: ${key}`);
  seen.add(key);
  const source = inventoryByIdentity.get(key);
  if (source === undefined) throw new Error(`unknown registry entry: ${key}`);
  assertEntrySourceMatches(entry, source, key);
}

function assertMandatoryEntry(
  entry: ReticleSpecCoverageEntry,
  inventoryByIdentity: ReadonlyMap<string, InventoryOutcome>,
  seen: Set<string>,
): void {
  const shapeError = validateEntryShape(entry);
  if (shapeError !== null) throw new Error(shapeError);
  assertEntryIdentityMatchesInventory(entry, inventoryByIdentity, seen);
}

function assertExcludedEntry(
  entry: ReticleSpecCoverageEntry,
  inventoryByIdentity: ReadonlyMap<string, InventoryOutcome>,
  seen: Set<string>,
): void {
  const identityError = validateEntryIdentity(entry);
  if (identityError !== null) throw new Error(identityError);
  assertEntryIdentityMatchesInventory(entry, inventoryByIdentity, seen);
}

export async function countCoverage(
  entries: readonly ReticleSpecCoverageEntry[],
  inventoryByIdentity: ReadonlyMap<string, InventoryOutcome>,
  seen: Set<string>,
  exclusions: ResolvedExclusions,
  flows: Set<string>,
  paths: ReticleSpecCoveragePaths,
): Promise<CoverageCounts> {
  let counts = EMPTY_COUNTS;
  for (const entry of entries) {
    if (exclusions.isExcludedEntry(excludedEntryIdentity(entry))) {
      assertExcludedEntry(entry, inventoryByIdentity, seen);
      counts = addExcluded(counts, entry);
      continue;
    }
    assertMandatoryEntry(entry, inventoryByIdentity, seen);
    counts = addCoverage(
      counts,
      await validateEntryCoverage(
        entry,
        paths.flowsRoot,
        paths.projectId,
        flows,
      ),
    );
  }
  return counts;
}
