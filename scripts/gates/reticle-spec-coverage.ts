import { writeFile } from "node:fs/promises";

import { isSafeReticleSegment } from "./reticle-flow-validation.ts";
import { validateConfiguredProjectId } from "./reticle-proof-validation.ts";
import {
  countCoverage,
  type InventoryOutcome,
} from "./reticle-spec-coverage-counts.ts";
import type { ResolvedExclusions } from "./reticle-spec-coverage-exclusions.ts";
import {
  excludedEntryIdentity,
  readReticleSpecCoverageExclusions,
  resolveExclusions,
} from "./reticle-spec-coverage-exclusions.ts";
import {
  identityKey,
  readRegistry,
  REGISTRY_VERSION,
  UNCLASSIFIED_OUTCOME,
  validateEntryIdentity,
  validateEntryShape,
} from "./reticle-spec-coverage-registry.ts";
import type {
  ReticleSpecCoverageEntry,
  ReticleSpecCoveragePaths,
  ReticleSpecCoverageRegistry,
  ReticleSpecCoverageSummary,
} from "./reticle-spec-coverage-types.ts";
import { preservedCoverage } from "./reticle-spec-coverage-types.ts";
import {
  inventoryOpenSpecScenarios,
  type OpenSpecOutcome,
  type OpenSpecScenario,
} from "./reticle-spec-inventory.ts";

export type {
  ReticleCoverage,
  ReticleSpecCoverageEntry,
  ReticleSpecCoverageExclusions,
  ReticleSpecCoveragePaths,
  ReticleSpecCoverageRegistry,
  ReticleSpecCoverageSummary,
} from "./reticle-spec-coverage-types.ts";
export type {
  OpenSpecInventorySummary,
  OpenSpecOutcome,
  OpenSpecScenario,
} from "./reticle-spec-inventory.ts";
export {
  inventoryOpenSpecScenarios,
  summarizeOpenSpecInventory,
} from "./reticle-spec-inventory.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const inventoryOutcomes = (
  inventory: readonly OpenSpecScenario[],
): InventoryOutcome[] =>
  inventory.flatMap((scenario) =>
    scenario.outcomes.map((outcome) => ({ scenario, outcome })),
  );

const outcomeEntry = (
  scenario: OpenSpecScenario,
  outcome: OpenSpecOutcome,
): ReticleSpecCoverageEntry => ({
  spec: scenario.spec,
  requirement: scenario.requirement,
  scenario: scenario.scenario,
  fingerprint: scenario.fingerprint,
  outcome,
  coverage: { kind: "unclassified" },
});

function previousCoverage(
  existing: ReticleSpecCoverageRegistry | undefined,
  exclusions: ResolvedExclusions,
): Map<string, ReticleSpecCoverageEntry> {
  const previous = new Map<string, ReticleSpecCoverageEntry>();
  for (const entry of existing?.scenarios ?? []) {
    const excluded = exclusions.isExcludedEntry(excludedEntryIdentity(entry));
    const shapeError = excluded
      ? validateEntryIdentity(entry)
      : validateEntryShape(entry);
    if (shapeError !== null && shapeError !== UNCLASSIFIED_OUTCOME)
      throw new Error(`invalid existing registry entry: ${shapeError}`);
    const key = identityKey(entry);
    if (previous.has(key))
      throw new Error(`duplicate existing registry entry: ${key}`);
    previous.set(key, entry);
  }
  return previous;
}

function assertEveryDerivedOutcomeIsSeen(
  derivedOutcomes: readonly InventoryOutcome[],
  seen: ReadonlySet<string>,
): void {
  const missing = derivedOutcomes.find(
    ({ scenario, outcome }) => !seen.has(identityKey({ ...scenario, outcome })),
  );
  if (missing === undefined) return;
  throw new Error(
    `missing registry outcome: ${identityKey({ ...missing.scenario, outcome: missing.outcome })}`,
  );
}

function assertMandatoryFloor(mandatory: number, floor: number): void {
  if (mandatory >= floor) return;
  throw new Error(
    `mandatory coverage floor not met: ${mandatory} < ${floor} declared outcomes`,
  );
}

export async function validateReticleSpecCoverage(
  paths: ReticleSpecCoveragePaths,
): Promise<ReticleSpecCoverageSummary> {
  const [inventory, registry, exclusions] = await Promise.all([
    inventoryOpenSpecScenarios(paths.specsRoot),
    readRegistry(paths.registryPath),
    readReticleSpecCoverageExclusions(paths.exclusionsPath),
  ]);
  validateConfiguredProjectId(registry, paths.projectId);
  const excluded = await resolveExclusions(
    exclusions,
    inventory,
    paths.projectId,
  );
  const derivedOutcomes = inventoryOutcomes(inventory);
  const inventoryByIdentity = new Map(
    derivedOutcomes.map((item) => [
      identityKey({ ...item.scenario, outcome: item.outcome }),
      item,
    ]),
  );
  const seen = new Set<string>();
  const flows = new Set<string>();
  const counts = await countCoverage(
    registry.scenarios,
    inventoryByIdentity,
    seen,
    excluded,
    flows,
    paths,
  );
  assertEveryDerivedOutcomeIsSeen(derivedOutcomes, seen);
  const mandatoryOutcomes = derivedOutcomes.length - counts.excludedOutcomes;
  assertMandatoryFloor(mandatoryOutcomes, excluded.minimumMandatoryOutcomes);
  return {
    scenarios: inventory.length,
    outcomes: derivedOutcomes.length,
    ...counts,
    mandatoryOutcomes,
    flows: flows.size,
  };
}

export async function refreshReticleSpecCoverage(input: {
  readonly specsRoot: string;
  readonly registryPath: string;
  readonly projectId: string;
  readonly exclusionsPath?: string;
}): Promise<ReticleSpecCoverageRegistry> {
  const inventory = await inventoryOpenSpecScenarios(input.specsRoot);
  let existing: ReticleSpecCoverageRegistry | undefined;
  try {
    existing = await readRegistry(input.registryPath);
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
  if (existing !== undefined && existing.projectId !== input.projectId) {
    throw new Error("registry projectId mismatch");
  }
  if (!isSafeReticleSegment(input.projectId)) {
    throw new Error("invalid registry projectId");
  }
  const previous = previousCoverage(
    existing,
    await resolveExclusions(
      await readReticleSpecCoverageExclusions(input.exclusionsPath),
      inventory,
      input.projectId,
    ),
  );
  const registry: ReticleSpecCoverageRegistry = {
    version: REGISTRY_VERSION,
    projectId: input.projectId,
    scenarios: inventoryOutcomes(inventory).map(({ scenario, outcome }) => {
      const key = identityKey({ ...scenario, outcome });
      return {
        ...outcomeEntry(scenario, outcome),
        coverage: preservedCoverage(previous.get(key), scenario, outcome),
      };
    }),
  };
  await writeFile(input.registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  return registry;
}
