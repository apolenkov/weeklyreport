import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  type CampaignMatrixPlan,
  type CampaignMatrixState,
  compileCampaignMatrix,
} from "./campaign-matrix.ts";
import {
  type CampaignManifest,
  campaignManifestSchema,
  type Role,
  type RouteBindingTarget,
  SEED_PROFILES,
  type SeedProfile,
  seedProfileSchema,
} from "./contracts.ts";
import { sha256Hex } from "./ids.ts";
import {
  type FrozenMatrix,
  type MatrixExecutableCase,
  parseFrozenMatrix,
} from "./matrix-finalizer.ts";
import {
  bindRouteDeclaration,
  profileCapabilitiesFromDefinitions,
} from "./route-binding.ts";

export type RuntimeMatrixSelection = Readonly<{
  readonly runnable: readonly CampaignMatrixState[];
  readonly specialized: readonly CampaignMatrixState[];
  readonly cases: readonly MatrixExecutableCase[];
}>;

export type RuntimeMatrixSource = Readonly<{
  readonly manifest: CampaignManifest;
  readonly plan: CampaignMatrixPlan;
  readonly matrix: FrozenMatrix;
  readonly routes: CampaignManifest["routes"];
  readonly selected: RuntimeMatrixSelection;
  readonly manifestDigestMatches: boolean;
  readonly legacyBindings: boolean;
}>;

class RuntimeMatrixManifestError extends Error {
  override readonly name = "RuntimeMatrixManifestError";
}

class RuntimeMatrixScaleError extends Error {
  override readonly name = "RuntimeMatrixScaleError";
}

export const DEFAULT_RUNTIME_MATRIX_MAX_CELLS = 100_000;

const readFrozenMatrix = async (matrixPath: string): Promise<FrozenMatrix> => {
  try {
    return parseFrozenMatrix(JSON.parse(await readFile(matrixPath, "utf8")));
  } catch (error: unknown) {
    throw new RuntimeMatrixManifestError(
      `Frozen MATRIX.json is required beside MANIFEST.json: ${error instanceof Error ? error.message : "unable to read matrix"}`,
    );
  }
};

export function selectRuntimeStates(
  _plan: CampaignMatrixPlan,
  profile: SeedProfile,
  frozenCases: readonly MatrixExecutableCase[],
): RuntimeMatrixSelection {
  const selected = statesFromFrozenCases(frozenCases, profile);
  const cases = frozenCases.filter(
    ({ profile: candidate }) => candidate === profile,
  );
  return {
    runnable: selected.filter(
      ({ axes }) => axes.fault === "none" && axes.controlTransition === "none",
    ),
    specialized: selected.filter(
      ({ axes }) => axes.fault !== "none" || axes.controlTransition !== "none",
    ),
    cases,
  };
}

const statesFromFrozenCases = (
  cases: readonly MatrixExecutableCase[],
  profile: SeedProfile,
): readonly CampaignMatrixState[] => {
  const selected = cases
    .filter(({ profile: candidate }) => candidate === profile)
    .toSorted((left, right) => left.stateId.localeCompare(right.stateId));
  const firstByStateId = new Map(
    selected.toReversed().map((entry) => [entry.stateId, entry] as const),
  );
  return selected
    .filter((entry) => firstByStateId.get(entry.stateId) === entry)
    .map((entry) => {
      const axes = {
        role: entry.role,
        route: `${entry.role}:${entry.catalogRoute}`,
        ...entry.state,
      };
      return {
        stateId: entry.stateId,
        profile: entry.profile,
        axes,
        pairwiseDigest: sha256Hex(axes),
      };
    });
};

function profileCapabilities(manifest: CampaignManifest) {
  const definitionFor = (profile: SeedProfile) => {
    const binding = manifest.seedProfiles.find(
      (candidate) => candidate.profile === profile,
    );
    if (!binding)
      throw new RuntimeMatrixManifestError(
        `Manifest is missing profile ${profile}`,
      );
    return binding.definition;
  };
  return profileCapabilitiesFromDefinitions({
    minimal: definitionFor(SEED_PROFILES[0]),
    demo: definitionFor(SEED_PROFILES[1]),
    full: definitionFor(SEED_PROFILES[2]),
    stress: definitionFor(SEED_PROFILES[3]),
  });
}

function enrichRoutes(manifest: CampaignManifest): CampaignManifest["routes"] {
  const capabilities = profileCapabilities(manifest);
  return manifest.routes.map((route) => {
    const binding = bindRouteDeclaration(
      {
        role: route.role,
        catalogRoute: route.catalogRoute,
        ...(route.allowsCurrentLive === undefined
          ? {}
          : { allowsCurrentLive: route.allowsCurrentLive }),
      },
      capabilities,
    );
    if (binding.resolvedRoute !== route.resolvedRoute) {
      throw new RuntimeMatrixManifestError(
        `Manifest route changed resolution: ${route.role}:${route.catalogRoute}`,
      );
    }
    return { ...route, bindings: binding.bindings };
  });
}

export async function loadRuntimeMatrix(
  input: Readonly<{
    readonly archiveRoot: string;
    readonly profile: string;
    readonly maxCells?: number;
  }>,
): Promise<RuntimeMatrixSource> {
  const maxCells = input.maxCells ?? DEFAULT_RUNTIME_MATRIX_MAX_CELLS;
  if (!Number.isInteger(maxCells) || maxCells < 1)
    throw new RuntimeMatrixScaleError(
      "Runtime matrix maxCells must be positive",
    );
  const manifestPath = path.join(
    path.resolve(input.archiveRoot),
    "MANIFEST.json",
  );
  const manifest = campaignManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  const matrixPath = path.join(path.dirname(manifestPath), "MATRIX.json");
  const matrix = await readFrozenMatrix(matrixPath);
  const profile = seedProfileSchema.parse(input.profile);
  const routes = enrichRoutes(manifest);
  const plan = compileCampaignMatrix({
    sourceSha: manifest.sourceSha,
    declaration: manifest.matrixDeclaration,
    routes,
    seedProfiles: manifest.seedProfiles,
  });
  const selected = selectRuntimeStates(plan, profile, matrix.cases);
  if (matrix.counts.total > maxCells) {
    throw new RuntimeMatrixScaleError(
      `Runtime matrix has ${matrix.counts.total} finalized cases; max is ${maxCells}`,
    );
  }
  return {
    manifest,
    plan,
    matrix,
    routes,
    selected,
    manifestDigestMatches:
      matrix.digest === manifest.matrixDigest &&
      matrix.sourceSha === manifest.sourceSha,
    legacyBindings: manifest.routes.some(
      ({ bindings }) => bindings === undefined,
    ),
  };
}

export function assertFreshRuntimeManifest(source: RuntimeMatrixSource): void {
  if (source.legacyBindings || !source.manifestDigestMatches) {
    throw new RuntimeMatrixManifestError(
      "Runtime matrix manifest is stale; regenerate MANIFEST.json at the final source SHA before launching a browser drive",
    );
  }
}

export function routeForState(
  source: RuntimeMatrixSource,
  state: CampaignMatrixState,
): Readonly<{
  readonly role: Role;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly target: RouteBindingTarget;
}> {
  const routeKey = state.axes.route;
  const route = source.routes.find(
    (candidate) => `${candidate.role}:${candidate.catalogRoute}` === routeKey,
  );
  if (!route?.bindings)
    throw new RuntimeMatrixManifestError(
      `Matrix route is not bound: ${routeKey}`,
    );
  const assignment = route.bindings.find(
    (binding) => binding.profile === state.profile,
  );
  if (assignment?.status !== "assigned")
    throw new RuntimeMatrixManifestError(
      `Matrix route is not assigned: ${routeKey}`,
    );
  return {
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: assignment.resolvedRoute,
    target: assignment.target,
  };
}
