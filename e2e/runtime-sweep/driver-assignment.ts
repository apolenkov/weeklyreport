import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type CampaignManifest,
  campaignManifestSchema,
  type Role,
  type RouteBindingTarget,
  SEED_PROFILES,
} from "./contracts.ts";
import { type DriveEnvironment } from "./driver-environment.ts";
import { DriverAssignmentError } from "./driver-errors.ts";
import {
  createDriverShardPlan,
  type DriverShardAssignment,
} from "./driver-shards.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import { parseFrozenMatrix } from "./matrix-finalizer.ts";

export { readAssignedCells } from "./driver-cell-files.ts";
export {
  assertRuntimeSweepBaseURLLive,
  type DriveEnvironment,
  requireDriverEnvironment,
  requireRuntimeSweepBaseURL,
  type RuntimeSweepLiveProbe,
} from "./driver-environment.ts";
export { DriverAssignmentError } from "./driver-errors.ts";

const NOT_APPLICABLE = "not-applicable" as const;
const DRIVER_DIRECTORY = "driver";
interface DriverRouteAssignment {
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly target: RouteBindingTarget;
  readonly shards: readonly DriverShardAssignment[];
}

export type DriverAssignment =
  | {
      readonly status: "assigned";
      readonly profile: (typeof SEED_PROFILES)[number];
      readonly role: Role;
      readonly routes: readonly DriverRouteAssignment[];
      readonly shards: readonly DriverShardAssignment[];
    }
  | {
      readonly status: typeof NOT_APPLICABLE;
      readonly profile: (typeof SEED_PROFILES)[number];
      readonly role: Role;
      readonly routes: readonly [];
      readonly shards: readonly [];
      readonly reason: string;
    };

interface DriverSkipRecord {
  readonly status: typeof NOT_APPLICABLE;
  readonly sourceSha: string;
  readonly profile: (typeof SEED_PROFILES)[number];
  readonly role: Role;
  readonly reason: string;
}

interface DeclaredAssignedRoute {
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly target: RouteBindingTarget;
}

const routeIdentity = (route: {
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
}): string => `${route.catalogRoute}\u0000${route.resolvedRoute}`;

const declaredRoutesFor = (
  manifest: Pick<CampaignManifest, "routes">,
  profile: (typeof SEED_PROFILES)[number],
  role: Role,
): readonly DeclaredAssignedRoute[] => {
  const roleRoutes = manifest.routes.filter((route) => route.role === role);
  return roleRoutes.flatMap((route) => {
    if (!route.bindings) {
      throw new DriverAssignmentError(
        `Manifest route ${role} ${route.catalogRoute} has no profile bindings`,
      );
    }
    const binding = route.bindings.find(
      (candidate) => candidate.profile === profile,
    );
    if (!binding) {
      throw new DriverAssignmentError(
        `Manifest route ${role} ${route.catalogRoute} has no binding for ${profile}`,
      );
    }
    return binding.status === "assigned"
      ? [
          {
            catalogRoute: route.catalogRoute,
            resolvedRoute: binding.resolvedRoute,
            target: binding.target,
          },
        ]
      : [];
  });
};

export function resolveDriverAssignment(
  manifest: Pick<CampaignManifest, "routes">,
  profile: (typeof SEED_PROFILES)[number],
  role: Role,
  cases: readonly MatrixExecutableCase[],
): DriverAssignment {
  const declaredRoutes = declaredRoutesFor(manifest, profile, role);
  if (declaredRoutes.length === 0)
    return {
      status: NOT_APPLICABLE,
      profile,
      role,
      routes: [],
      shards: [],
      reason: `Manifest assigns no routes to ${profile}/${role}`,
    };
  const selectedCases = cases.filter(
    (candidate) => candidate.profile === profile && candidate.role === role,
  );
  const declaredRouteKeys = new Set(declaredRoutes.map(routeIdentity));
  const unexpected = selectedCases.filter(
    (candidate) => !declaredRouteKeys.has(routeIdentity(candidate)),
  );
  if (unexpected.length > 0)
    throw new DriverAssignmentError(
      `Finalized cases contain unassigned route ${unexpected[0]?.catalogRoute ?? "unknown"} for ${profile}/${role}`,
    );
  const routes = declaredRoutes
    .toSorted((left, right) =>
      routeIdentity(left).localeCompare(routeIdentity(right)),
    )
    .map((declaredRoute) => {
      const routeCases = selectedCases.filter(
        (candidate) =>
          routeIdentity(candidate) === routeIdentity(declaredRoute),
      );
      if (routeCases.length === 0)
        throw new DriverAssignmentError(
          `Missing finalized cases for assigned route ${role} ${declaredRoute.catalogRoute} (${profile})`,
        );
      const shardPlan = createDriverShardPlan(routeCases, declaredRoute.target);
      return { ...declaredRoute, shards: shardPlan.assignments };
    });
  const shards = routes.flatMap(({ shards: routeShards }) => routeShards);
  return { status: "assigned", profile, role, routes, shards };
}

export async function readCampaignManifest(
  environment: DriveEnvironment,
): Promise<CampaignManifest> {
  const declaredManifestPath = process.env.RUNTIME_SWEEP_MANIFEST?.trim();
  const manifestPath = declaredManifestPath
    ? path.resolve(declaredManifestPath)
    : path.join(environment.archive, "MANIFEST.json");
  const text = await readFile(manifestPath, "utf8");
  return campaignManifestSchema.parse(JSON.parse(text));
}

export async function readCampaignMatrix(
  environment: DriveEnvironment,
): Promise<readonly MatrixExecutableCase[]> {
  const declaredMatrixPath = process.env.RUNTIME_SWEEP_MATRIX?.trim();
  const matrixPath = declaredMatrixPath
    ? path.resolve(declaredMatrixPath)
    : path.join(environment.archive, "MATRIX.json");
  try {
    const matrix = parseFrozenMatrix(
      JSON.parse(await readFile(matrixPath, "utf8")),
    );
    return matrix.cases;
  } catch (error: unknown) {
    throw new DriverAssignmentError(
      `Frozen runtime matrix is required beside MANIFEST.json: ${error instanceof Error ? error.message : "unable to read matrix"}`,
      { cause: error },
    );
  }
}

export async function writeSkippedDrive(
  environment: DriveEnvironment,
  assignment: Extract<DriverAssignment, { status: typeof NOT_APPLICABLE }>,
): Promise<void> {
  const outputDir = path.join(
    environment.archive,
    DRIVER_DIRECTORY,
    environment.sourceSha,
    assignment.profile,
  );
  const record: DriverSkipRecord = {
    status: NOT_APPLICABLE,
    sourceSha: environment.sourceSha,
    profile: assignment.profile,
    role: assignment.role,
    reason: assignment.reason,
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, `${assignment.role}.skip.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
}
