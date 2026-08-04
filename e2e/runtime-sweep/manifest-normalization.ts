import {
  type CampaignManifest,
  CANONICAL_ROLES,
  type Exclusion,
  type Role,
  type RouteDeclaration,
  type RouteDeclarationInput,
  SEED_PROFILES,
  type SeedProfile,
  seedProfileDefinitionSchema,
} from "./contracts.ts";
import { sha256Hex } from "./ids.ts";
import {
  type CampaignManifestInput,
  ManifestInputError,
  type SeedProfileDefinitionInput,
} from "./manifest-source.ts";
import {
  bindRouteDeclaration,
  profileCapabilitiesFromDefinitions,
} from "./route-binding.ts";

const REQUIRED_EXCLUSION_TARGETS = [
  "firefox",
  "webkit",
  "mobile",
  "tablet",
] as const;

export function sortRoles(roles: readonly Role[]): readonly Role[] {
  const unique = new Set(roles);
  if (
    unique.size !== CANONICAL_ROLES.length ||
    CANONICAL_ROLES.some((role) => !unique.has(role))
  ) {
    throw new ManifestInputError(
      "Manifest must declare all canonical roles once",
    );
  }
  return [...CANONICAL_ROLES];
}

export function completeSet<T extends string>(
  values: readonly T[],
  expected: readonly T[],
  label: string,
): readonly T[] {
  const unique = new Set(values);
  if (
    unique.size !== expected.length ||
    expected.some((value) => !unique.has(value))
  ) {
    throw new ManifestInputError(`Manifest must declare all ${label}`);
  }
  return [...expected];
}

function sortRoutes(
  routes: readonly RouteDeclarationInput[],
  profileCapabilities: ReturnType<typeof profileCapabilitiesFromDefinitions>,
): readonly RouteDeclaration[] {
  const keys = routes.map(
    ({ role, catalogRoute, resolvedRoute }) =>
      `${role}\0${catalogRoute}\0${resolvedRoute}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new ManifestInputError("Manifest routes must be unique");
  if (new Set(routes.map(({ role }) => role)).size !== CANONICAL_ROLES.length)
    throw new ManifestInputError(
      "Manifest routes must cover all canonical roles",
    );
  return routes
    .toSorted(
      (left, right) =>
        left.role.localeCompare(right.role) ||
        left.catalogRoute.localeCompare(right.catalogRoute) ||
        left.resolvedRoute.localeCompare(right.resolvedRoute),
    )
    .map((route) => {
      const binding = bindRouteDeclaration(
        {
          role: route.role,
          catalogRoute: route.catalogRoute,
          ...(route.allowsCurrentLive === undefined
            ? {}
            : { allowsCurrentLive: route.allowsCurrentLive }),
        },
        profileCapabilities,
      );
      if (route.resolvedRoute !== binding.resolvedRoute)
        throw new ManifestInputError(
          `Manifest route ${route.role} ${route.catalogRoute} resolves to ${route.resolvedRoute}; expected ${binding.resolvedRoute}`,
        );
      return {
        ...route,
        resolvedRoute: binding.resolvedRoute,
        allowsCurrentLive: binding.allowsCurrentLive,
        bindings: binding.bindings,
      };
    });
}

export function sortExclusions(
  exclusions: readonly Exclusion[],
): readonly Exclusion[] {
  const targets = new Set(exclusions.map(({ target }) => target.toLowerCase()));
  const missing = REQUIRED_EXCLUSION_TARGETS.filter(
    (target) => !targets.has(target),
  );
  if (missing.length > 0)
    throw new ManifestInputError(
      `Manifest exclusions are missing: ${missing.join(", ")}`,
    );
  return exclusions.toSorted(
    (left, right) =>
      left.scope.localeCompare(right.scope) ||
      left.target.localeCompare(right.target) ||
      left.id.localeCompare(right.id),
  );
}

function seedBindings(
  definitions: readonly SeedProfileDefinitionInput[],
): CampaignManifest["seedProfiles"] {
  if (definitions.length !== SEED_PROFILES.length)
    throw new ManifestInputError("Manifest must declare four seed profiles");
  const parsed = definitions.map(({ profile, definition }) => ({
    profile,
    definition: seedProfileDefinitionSchema.parse(definition),
    digest: sha256Hex({ profile, definition }),
  }));
  if (
    new Set(parsed.map(({ profile }) => profile)).size !== SEED_PROFILES.length
  )
    throw new ManifestInputError("Manifest seed profiles must be unique");
  return parsed.toSorted((left, right) =>
    left.profile.localeCompare(right.profile),
  );
}

function profileCapabilities(
  definitions: readonly CampaignManifest["seedProfiles"][number][],
) {
  const find = (profile: SeedProfile) => {
    const binding = definitions.find(
      (candidate) => candidate.profile === profile,
    );
    if (binding === undefined)
      throw new ManifestInputError(`Missing seed profile ${profile}`);
    return binding.definition;
  };
  return profileCapabilitiesFromDefinitions({
    minimal: find("minimal"),
    demo: find("demo"),
    full: find("full"),
    stress: find("stress"),
  });
}

export function normalizeRoutesAndProfiles(input: CampaignManifestInput): {
  readonly seedProfiles: CampaignManifest["seedProfiles"];
  readonly routes: readonly RouteDeclaration[];
} {
  const seedProfiles = seedBindings(input.seedProfiles);
  return {
    seedProfiles,
    routes: sortRoutes(input.routes, profileCapabilities(seedProfiles)),
  };
}
