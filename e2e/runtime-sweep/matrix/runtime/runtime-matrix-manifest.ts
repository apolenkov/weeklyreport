import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseRevealSurface,
  type RevealSurface,
} from "../../preflight/reveal-path.ts";
import {
  type CampaignManifest,
  campaignManifestSchema,
  type SeedProfile,
  seedProfileSchema,
} from "../../source/contracts.ts";
import { assertRuntimeSourceAuthorityFromEnvironment } from "../../source/runtime-source-authority.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex } from "../../support/ids.ts";
import {
  assertFrozenResolverOutcomes,
  resolverOutcomeGapsFor,
  type ResolverOutcomeNotApplicable,
} from "../../support/resolver-outcome-expectations.ts";
import {
  type CampaignMatrixPlan,
  type CampaignMatrixState,
  compileCampaignMatrix,
} from "../campaign-matrix.ts";
import {
  type FrozenMatrix,
  type MatrixExecutableCase,
  parseFrozenMatrix,
} from "../matrix-finalizer.ts";
import {
  parseRevealTransition,
  type RevealTransition,
} from "../reveal-transition.ts";
import {
  enrichRuntimeMatrixRoutes,
  RuntimeMatrixManifestError,
} from "./runtime-matrix-route-carrier.ts";
import {
  type MatrixRouteResolutionError,
  routeForState as resolveRouteForState,
} from "./runtime-matrix-route-resolution.ts";

export type RuntimeMatrixSelection = Readonly<{
  readonly runnable: readonly CampaignMatrixState[];
  readonly specialized: readonly CampaignMatrixState[];
  readonly cases: readonly MatrixExecutableCase[];
}>;

export type RuntimeMatrixSource = Readonly<{
  readonly manifest: CampaignManifest;
  readonly sourceDigest: string;
  readonly resolverOutcomeGaps: readonly ResolverOutcomeNotApplicable[];
  readonly plan: CampaignMatrixPlan;
  readonly matrix: FrozenMatrix;
  readonly revealSurfacesByDigest: ReadonlyMap<string, RevealSurface>;
  readonly revealTransitionsByDigest: ReadonlyMap<string, RevealTransition>;
  readonly routes: CampaignManifest["routes"];
  readonly selected: RuntimeMatrixSelection;
  readonly manifestDigestMatches: boolean;
  readonly legacyBindings: boolean;
}>;

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

const readRuntimeArtifacts = async (
  archiveRoot: string,
): Promise<
  Readonly<{
    readonly manifest: CampaignManifest;
    readonly source: SourceArtifact;
    readonly matrix: FrozenMatrix;
  }>
> => {
  const manifestPath = path.join(path.resolve(archiveRoot), "MANIFEST.json");
  const manifest = campaignManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  const source = (await assertRuntimeSourceAuthorityFromEnvironment()).source;
  if (source.sourceSha !== manifest.sourceSha)
    throw new RuntimeMatrixManifestError(
      "SOURCE.json source SHA does not match MANIFEST.json",
    );
  const matrix = await readFrozenMatrix(
    path.join(path.dirname(manifestPath), "MATRIX.json"),
  );
  return { manifest, source, matrix };
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

const resolverGapsForPlan = (
  routes: CampaignManifest["routes"],
  plan: CampaignMatrixPlan,
  declarations: SourceArtifact["specializedDeclarations"],
): readonly ResolverOutcomeNotApplicable[] =>
  routes.flatMap((route) =>
    route.kind === "resolver"
      ? resolverOutcomeGapsFor(route, plan.states, declarations)
      : [],
  );

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
  const { manifest, source, matrix } = await readRuntimeArtifacts(
    input.archiveRoot,
  );
  const profile = seedProfileSchema.parse(input.profile);
  const routes = enrichRuntimeMatrixRoutes(manifest);
  const plan = compileCampaignMatrix({
    sourceSha: manifest.sourceSha,
    declaration: manifest.matrixDeclaration,
    routes,
    seedProfiles: manifest.seedProfiles,
  });
  assertFrozenResolverOutcomes(
    routes,
    matrix.cases,
    source.sourceDigest,
    source.specializedDeclarations,
  );
  const selected = selectRuntimeStates(plan, profile, matrix.cases);
  const resolverOutcomeGaps = resolverGapsForPlan(
    routes,
    plan,
    source.specializedDeclarations,
  );
  if (matrix.counts.total > maxCells) {
    throw new RuntimeMatrixScaleError(
      `Runtime matrix has ${matrix.counts.total} finalized cases; max is ${maxCells}`,
    );
  }
  return {
    manifest,
    sourceDigest: source.sourceDigest,
    resolverOutcomeGaps,
    plan,
    matrix,
    revealSurfacesByDigest: new Map(
      matrix.revealSurfaces.map((surface) => [
        surface.digest,
        parseRevealSurface(surface),
      ]),
    ),
    revealTransitionsByDigest: new Map(
      matrix.revealTransitions.map((transition) => [
        transition.digest,
        parseRevealTransition(transition),
      ]),
    ),
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
  if (source.resolverOutcomeGaps.length > 0)
    throw new RuntimeMatrixManifestError(
      `Runtime matrix has blocked resolver outcomes: ${source.resolverOutcomeGaps
        .map(
          ({ profile, outcome, constraintId, reason }) =>
            `${profile}/${outcome}/${constraintId}: ${reason}`,
        )
        .join("; ")}`,
    );
  if (source.legacyBindings || !source.manifestDigestMatches) {
    throw new RuntimeMatrixManifestError(
      "Runtime matrix manifest is stale; regenerate MANIFEST.json at the final source SHA before launching a browser drive",
    );
  }
}

export function routeForState(
  source: RuntimeMatrixSource,
  state: CampaignMatrixState,
  resolverOutcome?: import("../../source/contracts.ts").ResolverOutcomeKind,
): ReturnType<typeof resolveRouteForState> {
  const fail: MatrixRouteResolutionError = (message) =>
    new RuntimeMatrixManifestError(message);
  return resolveRouteForState(source, state, resolverOutcome, fail);
}
