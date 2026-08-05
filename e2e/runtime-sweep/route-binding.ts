import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../prisma/seed-constants.ts";
import {
  SEED_PROFILE_MANIFESTS,
  type SeedCapability,
} from "../../prisma/seed-profile-contract.ts";
import type { CatalogRoute } from "../sweep/catalog-parser.ts";
import {
  type Role,
  type RouteBinding,
  type RouteBindingTarget,
  type RouteDeclaration,
  SEED_PROFILES,
  type SeedProfile,
} from "./contracts.ts";

const CURRENT_LIVE_MARKERS = [
  "viewer-live-status",
  "current editable period live",
  "published-or-current",
] as const;
const REPORT_ROUTE_PREFIX = "/reports/";
const REPORT_ID_PLACEHOLDER = "[reportId]";

export interface RouteBindingDeclaration {
  readonly role: Role;
  readonly catalogRoute: string;
  readonly allowsCurrentLive?: boolean;
}

export interface RouteBindingResult {
  readonly role: Role;
  readonly catalogRoute: string;
  readonly allowsCurrentLive: boolean;
  readonly target: RouteBindingTarget;
  readonly requiredCapability: SeedCapability | null;
  readonly minimumProfile: SeedProfile;
  readonly resolvedRoute: string;
  readonly bindings: readonly RouteBinding[];
}

export type ProfileCapabilities = Readonly<
  Record<SeedProfile, readonly SeedCapability[]>
>;

const DEFAULT_PROFILE_CAPABILITIES: ProfileCapabilities = {
  minimal: SEED_PROFILE_MANIFESTS.minimal.capabilities,
  demo: SEED_PROFILE_MANIFESTS.demo.capabilities,
  full: SEED_PROFILE_MANIFESTS.full.capabilities,
  stress: SEED_PROFILE_MANIFESTS.stress.capabilities,
};

export function profileCapabilitiesFromDefinitions(
  definitions: Readonly<
    Record<SeedProfile, Readonly<{ capabilities: readonly SeedCapability[] }>>
  >,
): ProfileCapabilities {
  return {
    minimal: definitions.minimal.capabilities,
    demo: definitions.demo.capabilities,
    full: definitions.full.capabilities,
    stress: definitions.stress.capabilities,
  };
}

export function allowsViewerCurrentLive(
  catalog: CatalogRoute,
  role: Role,
): boolean {
  if (role !== "viewer") return false;
  const oracleText = catalog.intents
    .flatMap(({ intent, given, when, then, note }) => [
      intent,
      given,
      when,
      then,
      note,
    ])
    .join(" ")
    .toLowerCase();
  return CURRENT_LIVE_MARKERS.some((marker) => oracleText.includes(marker));
}

function targetForRoute(
  role: Role,
  catalogRoute: string,
  allowsCurrentLive: boolean,
): RouteBindingTarget {
  if (
    role === "viewer" &&
    allowsCurrentLive &&
    (catalogRoute === "/reports/latest" ||
      catalogRoute === `${REPORT_ROUTE_PREFIX}${REPORT_ID_PLACEHOLDER}`)
  ) {
    return "active";
  }
  if (
    catalogRoute.includes(REPORT_ID_PLACEHOLDER) &&
    catalogRoute.startsWith(REPORT_ROUTE_PREFIX)
  ) {
    return "published";
  }
  if (catalogRoute.includes(REPORT_ID_PLACEHOLDER)) return "active";
  return "none";
}

function capabilityForTarget(
  target: RouteBindingTarget,
  role: Role,
): SeedCapability | null {
  if (target === "active")
    return role === "viewer" ? "submission-contrast" : "editable-active-report";
  if (target === "published") return "published-period";
  return null;
}

function minimumProfileFor(
  capability: SeedCapability | null,
  profileCapabilities: ProfileCapabilities,
): SeedProfile {
  if (!capability) return "minimal";
  const profile = SEED_PROFILES.find((candidate) =>
    profileCapabilities[candidate].includes(capability),
  );
  if (!profile) {
    throw new Error(`No seed profile provides ${capability}`);
  }
  return profile;
}

function reportIdForTarget(target: RouteBindingTarget): string | null {
  if (target === "active") return ACTIVE_REPORT_ID;
  if (target === "published") return PUBLISHED_REPORT_ID;
  return null;
}

function resolveRoute(
  catalogRoute: string,
  target: RouteBindingTarget,
): string {
  const reportId = reportIdForTarget(target);
  const resolved = reportId
    ? catalogRoute.replaceAll(REPORT_ID_PLACEHOLDER, reportId)
    : catalogRoute;
  if (resolved.includes("[")) {
    throw new Error(`Unresolved catalog route placeholder: ${catalogRoute}`);
  }
  return resolved;
}

function bindingForProfile(
  profile: SeedProfile,
  minimumProfile: SeedProfile,
  target: RouteBindingTarget,
  requiredCapability: SeedCapability | null,
  resolvedRoute: string,
  profileCapabilities: ProfileCapabilities,
): RouteBinding {
  const hasCapability =
    requiredCapability === null ||
    profileCapabilities[profile].includes(requiredCapability);
  if (hasCapability) {
    return {
      status: "assigned",
      profile,
      target,
      requiredCapability,
      resolvedRoute,
      rationale:
        profile === minimumProfile
          ? requiredCapability
            ? `Smallest profile declaring ${requiredCapability}`
            : "Smallest profile for a route without a seed capability"
          : `Profile extends ${minimumProfile} and exercises the same route with additional seeded state`,
    };
  }
  return {
    status: "not-applicable",
    profile,
    target,
    requiredCapability,
    resolvedRoute,
    reason: `Profile does not declare required capability ${requiredCapability}`,
  };
}

export function bindRouteDeclaration(
  declaration: RouteBindingDeclaration,
  profileCapabilities: ProfileCapabilities = DEFAULT_PROFILE_CAPABILITIES,
): RouteBindingResult {
  const allowsCurrentLive = declaration.allowsCurrentLive ?? false;
  const target = targetForRoute(
    declaration.role,
    declaration.catalogRoute,
    allowsCurrentLive,
  );
  const requiredCapability = capabilityForTarget(target, declaration.role);
  const minimumProfile = minimumProfileFor(
    requiredCapability,
    profileCapabilities,
  );
  const resolvedRoute = resolveRoute(declaration.catalogRoute, target);
  const bindings = SEED_PROFILES.map((profile) =>
    bindingForProfile(
      profile,
      minimumProfile,
      target,
      requiredCapability,
      resolvedRoute,
      profileCapabilities,
    ),
  );
  return {
    role: declaration.role,
    catalogRoute: declaration.catalogRoute,
    allowsCurrentLive,
    target,
    requiredCapability,
    minimumProfile,
    resolvedRoute,
    bindings,
  };
}

export function bindCatalogRoute(
  catalog: CatalogRoute,
  role: Role,
  profileCapabilities: ProfileCapabilities = DEFAULT_PROFILE_CAPABILITIES,
): RouteBindingResult {
  return bindRouteDeclaration(
    {
      role,
      catalogRoute: catalog.route,
      allowsCurrentLive: allowsViewerCurrentLive(catalog, role),
    },
    profileCapabilities,
  );
}

export function bindingForProfileOrThrow(
  binding: RouteBindingResult,
  profile: SeedProfile,
): Extract<RouteBinding, { status: "assigned" }> {
  const assignment = binding.bindings.find(
    (candidate): candidate is Extract<RouteBinding, { status: "assigned" }> =>
      candidate.profile === profile && candidate.status === "assigned",
  );
  if (!assignment) {
    const selected = binding.bindings.find(
      (candidate) => candidate.profile === profile,
    );
    const reason =
      selected?.status === "not-applicable"
        ? selected.reason
        : "unknown binding";
    throw new Error(
      `${binding.role} ${binding.catalogRoute} is not assigned to ${profile}: ${reason}`,
    );
  }
  return assignment;
}

export function routeDeclarationFromCatalog(
  catalog: CatalogRoute,
  role: Role,
  profileCapabilities: ProfileCapabilities = DEFAULT_PROFILE_CAPABILITIES,
): RouteDeclaration {
  const binding = bindCatalogRoute(catalog, role, profileCapabilities);
  return {
    role: binding.role,
    catalogRoute: binding.catalogRoute,
    resolvedRoute: binding.resolvedRoute,
    allowsCurrentLive: binding.allowsCurrentLive,
    bindings: binding.bindings,
  };
}
