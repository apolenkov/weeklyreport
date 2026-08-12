import type {
  MatrixAxes,
  PermissionBoundary,
  Role,
  SeedCapability,
} from "../../source/contracts.ts";
import type { MatrixConstraint } from "../matrix.ts";
import { stateCapabilities } from "./matrix-coverage.ts";

const ROLE_PERMISSIONS: Readonly<
  Record<Role, ReadonlySet<PermissionBoundary>>
> = {
  lead: new Set(["allowed", "owner", "non-owner", "anonymous"]),
  head: new Set(["allowed", "head", "anonymous"]),
  admin: new Set(["allowed", "admin", "anonymous"]),
  viewer: new Set(["allowed", "viewer", "anonymous"]),
};

export const permissionsForRole = (
  role: Role,
  values: readonly PermissionBoundary[],
): readonly PermissionBoundary[] =>
  values.filter((value) => ROLE_PERMISSIONS[role].has(value));

export const VIEWER_PUBLISHED_ROUTE = "viewer:/reports/[reportId]/present";
export const VIEWER_PUBLISHED_ROUTE_NONCURRENT_LIFECYCLE =
  "viewer-published-route-noncurrent-lifecycle";
const VIEWER_PUBLISHED_ROUTE_NONCURRENT_REASON =
  "Viewer published-target route rejects non-current open/reopened periods";

const isViewerPublishedRouteNonCurrent = (
  axes: Readonly<Partial<MatrixAxes>>,
): boolean =>
  axes.role === "viewer" &&
  axes.route === VIEWER_PUBLISHED_ROUTE &&
  (axes.lifecycle === "open" || axes.lifecycle === "reopened");

export const nominalLifecycleForRoute = (
  input: Readonly<{
    role: Role;
    route: string;
    lifecycleValues: readonly MatrixAxes["lifecycle"][];
  }>,
): MatrixAxes["lifecycle"] =>
  input.lifecycleValues.find(
    (candidate) =>
      !isViewerPublishedRouteNonCurrent({
        role: input.role,
        route: input.route,
        lifecycle: candidate,
      }),
  ) ??
  input.lifecycleValues.at(0) ??
  "open";

const viewerPublishedRouteNonCurrentConstraint: MatrixConstraint = {
  id: VIEWER_PUBLISHED_ROUTE_NONCURRENT_LIFECYCLE,
  reason: VIEWER_PUBLISHED_ROUTE_NONCURRENT_REASON,
  check: (axes) => !isViewerPublishedRouteNonCurrent(axes),
  // Keep the full row until the final axis so the inapplicable artifact
  // carries a complete state, not a partial route/lifecycle prefix.
  checkPartial: () => true,
};

export const campaignMatrixConstraints = (
  availableCapabilities: readonly SeedCapability[],
  routeCapability: SeedCapability | null,
): readonly MatrixConstraint[] => [
  {
    id: "profile-capability-boundary",
    reason: "State requires a capability absent from the seed profile",
    check: (axes) =>
      stateCapabilities(axes, routeCapability).every((capability) =>
        availableCapabilities.includes(capability),
      ),
    checkPartial: (axes) =>
      stateCapabilities(axes, routeCapability).every((capability) =>
        availableCapabilities.includes(capability),
      ),
  },
  {
    id: "role-permission-boundary",
    reason: "Permission boundary is not meaningful for the session role",
    check: ({ role, permission }) => ROLE_PERMISSIONS[role].has(permission),
    checkPartial: ({ role, permission }) =>
      role === undefined ||
      permission === undefined ||
      ROLE_PERMISSIONS[role].has(permission),
  },
  {
    id: "ownership-permission-boundary",
    reason: "Owner permission requires an assigned stage",
    check: ({ ownershipDensity, permission }) =>
      permission !== "owner" || ownershipDensity !== "none",
    checkPartial: ({ ownershipDensity, permission }) =>
      permission === undefined ||
      ownershipDensity === undefined ||
      permission !== "owner" ||
      ownershipDensity !== "none",
  },
  viewerPublishedRouteNonCurrentConstraint,
];
