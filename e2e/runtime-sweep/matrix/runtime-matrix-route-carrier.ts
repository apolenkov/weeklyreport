import {
  type CampaignManifest,
  SEED_PROFILES,
  type SeedProfile,
} from "../source/contracts.ts";
import {
  bindRouteDeclaration,
  profileCapabilitiesFromDefinitions,
} from "../support/route-binding.ts";

export class RuntimeMatrixManifestError extends Error {
  override readonly name = "RuntimeMatrixManifestError";
}

const profileCapabilities = (manifest: CampaignManifest) => {
  const definitionFor = (profile: SeedProfile) => {
    const binding = manifest.seedProfiles.find(
      (candidate) => candidate.profile === profile,
    );
    if (binding === undefined)
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
};

const enrichRoute = (
  route: CampaignManifest["routes"][number],
  capabilities: ReturnType<typeof profileCapabilitiesFromDefinitions>,
): CampaignManifest["routes"][number] => {
  const label = `${route.role}:${route.catalogRoute}`;
  const binding = bindRouteDeclaration(
    {
      role: route.role,
      catalogRoute: route.catalogRoute,
      ...(route.kind === undefined ? {} : { kind: route.kind }),
      ...(route.resolverKey === undefined
        ? {}
        : { resolverKey: route.resolverKey }),
      landingRoute: route.landingRoute,
      ...(route.allowsCurrentLive === undefined
        ? {}
        : { allowsCurrentLive: route.allowsCurrentLive }),
    },
    capabilities,
  );
  if (binding.resolvedRoute !== route.resolvedRoute)
    throw new RuntimeMatrixManifestError(
      `Manifest route changed resolution: ${label}`,
    );
  if (binding.kind === "resolver") {
    if (route.kind !== "resolver")
      throw new RuntimeMatrixManifestError(
        `Manifest resolver route lost kind discriminator: ${label}`,
      );
    return enrichResolverRoute(route, binding, label);
  }
  if (route.kind === "resolver")
    throw new RuntimeMatrixManifestError(
      `Manifest unconditional route has resolver discriminator: ${label}`,
    );
  return enrichUnconditionalRoute(route, binding, label);
};

const enrichResolverRoute = (
  route: Extract<
    CampaignManifest["routes"][number],
    { readonly kind: "resolver" }
  >,
  binding: Extract<
    ReturnType<typeof bindRouteDeclaration>,
    { readonly kind: "resolver" }
  >,
  label: string,
): CampaignManifest["routes"][number] => {
  if (route.resolverOutcomes.join("\0") !== binding.resolverOutcomes.join("\0"))
    throw new RuntimeMatrixManifestError(
      `Manifest resolver route changed outcomes: ${label}`,
    );
  const {
    landingRoute: _landingRoute,
    kind: _kind,
    resolverKey: _resolverKey,
    resolverOutcomes: _resolverOutcomes,
    ...resolverRoute
  } = route;
  return {
    ...resolverRoute,
    kind: "resolver",
    resolverKey: binding.resolverKey,
    resolverOutcomes: binding.resolverOutcomes,
    bindings: binding.bindings,
  };
};

const enrichUnconditionalRoute = (
  route: Exclude<
    CampaignManifest["routes"][number],
    { readonly kind: "resolver" }
  >,
  binding: Extract<
    ReturnType<typeof bindRouteDeclaration>,
    { readonly kind: "unconditional" }
  >,
  label: string,
): CampaignManifest["routes"][number] => {
  if (route.landingRoute !== binding.landingRoute)
    throw new RuntimeMatrixManifestError(
      `Manifest route changed landing: ${label}`,
    );
  const {
    resolverKey: _resolverKey,
    resolverOutcomes: _resolverOutcomes,
    kind: _kind,
    ...unconditionalRoute
  } = route;
  return {
    ...unconditionalRoute,
    ...(route.kind === undefined ? {} : { kind: "unconditional" as const }),
    landingRoute: binding.landingRoute,
    bindings: binding.bindings,
  };
};

export function enrichRuntimeMatrixRoutes(
  manifest: CampaignManifest,
): CampaignManifest["routes"] {
  const capabilities = profileCapabilities(manifest);
  return manifest.routes.map((route) => enrichRoute(route, capabilities));
}
