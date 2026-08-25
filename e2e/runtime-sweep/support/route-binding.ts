import {
  SEED_PROFILE_MANIFESTS,
  type SeedCapability,
} from "../../../prisma/seeds/profiles/seed-profile-contract.ts";
import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../../prisma/seeds/support/seed-constants.ts";
import type { CatalogRoute } from "../../sweep/catalog-parser.ts";
import { landingDeclarationRequiredFor } from "../../sweep/catalog-parser-landing.ts";
import {
  type NetworkEvidencePolicy,
  type ResolverKey,
  type Role,
  type RouteBindingTarget,
  type RouteDeclaration,
  SEED_PROFILES,
  type SeedProfile,
} from "../source/contracts.ts";
import {
  resolverOutcomeKindsFor,
  routeBindingsForProfiles,
  routeKindForDeclaration,
} from "./resolver-outcome-contract.ts";
import {
  resolveLandingRoute,
  type RouteBindingDeclaration,
  type RouteBindingResult,
  routeBindingResultForKind,
} from "./route-binding-landing.ts";
export {
  bindingForProfileOrThrow,
  type RouteBindingDeclaration,
  type RouteBindingResult,
} from "./route-binding-landing.ts";

const CURRENT_LIVE_MARKERS = [
  "viewer-live-status",
  "current editable period live",
  "published-or-current",
] as const;
const REPORT_ROUTE_PREFIX = "/reports/";
const REPORT_ID_PLACEHOLDER = "[reportId]";

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
    (role === "lead" && catalogRoute === "/lead/report") ||
    ((role === "head" || role === "admin") && catalogRoute === "/head/report")
  )
    return "active";
  if (
    role === "viewer" &&
    (catalogRoute === "/reports/latest" ||
      (allowsCurrentLive &&
        catalogRoute === `${REPORT_ROUTE_PREFIX}${REPORT_ID_PLACEHOLDER}`))
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

function requireResolverKey(resolverKey: ResolverKey | null): ResolverKey {
  if (resolverKey === null)
    throw new Error("Resolver route is missing its resolver key");
  return resolverKey;
}

export function bindRouteDeclaration(
  declaration: RouteBindingDeclaration,
  profileCapabilities: ProfileCapabilities = DEFAULT_PROFILE_CAPABILITIES,
): RouteBindingResult {
  const { kind, resolverKey } = routeKindForDeclaration(declaration);
  if (
    kind === "unconditional" &&
    declaration.landingRoute === undefined &&
    landingDeclarationRequiredFor(declaration.role, declaration.catalogRoute)
  )
    throw new Error(
      `Intentional redirect alias ${declaration.role}:${declaration.catalogRoute} requires an exact landing route declaration`,
    );
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
  const resolverOutcomes =
    kind === "resolver"
      ? resolverOutcomeKindsFor(requireResolverKey(resolverKey))
      : [];
  const landingRoute =
    kind === "resolver"
      ? undefined
      : resolveLandingRoute(
          declaration.catalogRoute,
          declaration.landingRoute,
          target,
          resolveRoute,
        );
  const bindings = routeBindingsForProfiles({
    minimumProfile,
    kind,
    resolverKey,
    resolverOutcomes,
    target,
    requiredCapability,
    resolvedRoute,
    landingRoute,
    profileCapabilities,
  });
  const common = {
    role: declaration.role,
    catalogRoute: declaration.catalogRoute,
    allowsCurrentLive,
    target,
    requiredCapability,
    minimumProfile,
    resolvedRoute,
    bindings,
  };
  return routeBindingResultForKind({
    common,
    kind,
    resolverKey,
    resolverOutcomes,
    landingRoute,
    requiredCapability,
  });
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
      ...(catalog.landing === undefined
        ? {}
        : { landingRoute: catalog.landing }),
      allowsCurrentLive: allowsViewerCurrentLive(catalog, role),
    },
    profileCapabilities,
  );
}

export function routeDeclarationFromCatalog(
  catalog: CatalogRoute,
  role: Role,
  networkPolicy: NetworkEvidencePolicy | null,
  profileCapabilities: ProfileCapabilities = DEFAULT_PROFILE_CAPABILITIES,
): RouteDeclaration {
  const binding = bindCatalogRoute(catalog, role, profileCapabilities);
  if (binding.kind === "resolver")
    return {
      role: binding.role,
      catalogRoute: binding.catalogRoute,
      kind: binding.kind,
      resolverKey: binding.resolverKey,
      resolverOutcomes: binding.resolverOutcomes,
      resolvedRoute: binding.resolvedRoute,
      networkPolicy,
      allowsCurrentLive: binding.allowsCurrentLive,
      bindings: binding.bindings,
    };
  return {
    role: binding.role,
    catalogRoute: binding.catalogRoute,
    kind: binding.kind,
    resolvedRoute: binding.resolvedRoute,
    landingRoute: binding.landingRoute,
    networkPolicy,
    allowsCurrentLive: binding.allowsCurrentLive,
    bindings: binding.bindings,
  };
}
