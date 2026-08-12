import {
  RESOLVER_OUTCOME_KINDS,
  type ResolverKey,
  resolverKeySchema,
  type ResolverOutcomeIdentity,
  resolverOutcomeIdentitySchema,
  type ResolverOutcomeInapplicable,
  resolverOutcomeInapplicableSchema,
  type ResolverOutcomeKind,
  type Role,
  type RouteBinding,
  type RouteKind,
  SEED_PROFILES,
  type SeedCapability,
  type SeedProfile,
  type SourceBoundResolverOutcome,
  sourceBoundResolverOutcomeSchema,
} from "../source/contracts.ts";

export const VIEWER_STATUS_RESOLVER_KEY = "viewer-status" as const;
const REPORT_LATEST_ROUTE = "/reports/latest";
const NO_CAPABILITY_REASON = "Profile is not applicable to this route";
const RESOLVER_ROUTE_KIND = "resolver" as const;
const UNCONDITIONAL_ROUTE_KIND = "unconditional" as const;
const NOT_APPLICABLE_STATUS = "not-applicable" as const;

type ProfileCapabilities = Readonly<
  Record<SeedProfile, readonly SeedCapability[]>
>;

function resolverKeyForRoute(role: Role, catalogRoute: string): string | null {
  return role === "viewer" && catalogRoute === REPORT_LATEST_ROUTE
    ? VIEWER_STATUS_RESOLVER_KEY
    : null;
}

export function routeKindForDeclaration(
  input: Readonly<{
    role: Role;
    catalogRoute: string;
    kind?: string | undefined;
    resolverKey?: string | undefined;
    landingRoute?: string | undefined;
  }>,
): Readonly<{ kind: RouteKind; resolverKey: ResolverKey | null }> {
  const inferredResolverKey = resolverKeyForRoute(
    input.role,
    input.catalogRoute,
  );
  const resolverKey = input.resolverKey ?? inferredResolverKey;
  const kind =
    input.kind ??
    (resolverKey === null ? UNCONDITIONAL_ROUTE_KIND : RESOLVER_ROUTE_KIND);
  if (kind === RESOLVER_ROUTE_KIND)
    assertResolverDeclaration(input, inferredResolverKey, resolverKey);
  else if (kind === UNCONDITIONAL_ROUTE_KIND)
    assertUnconditionalDeclaration(input, inferredResolverKey);
  else throw new Error(`Unknown route kind: ${kind}`);
  return {
    kind,
    resolverKey:
      resolverKey === null ? null : resolverKeySchema.parse(resolverKey),
  };
}

function assertResolverDeclaration(
  input: Readonly<{
    role: Role;
    catalogRoute: string;
    landingRoute?: string | undefined;
  }>,
  inferredResolverKey: string | null,
  resolverKey: string | null,
): void {
  if (input.landingRoute !== undefined)
    throw new Error(
      `Resolver route ${input.role}:${input.catalogRoute} cannot declare a static landing route`,
    );
  if (resolverKey === null)
    throw new Error(
      `Resolver route ${input.role}:${input.catalogRoute} requires an explicit resolver key`,
    );
  if (inferredResolverKey === null)
    throw new Error(
      `Unknown resolver route ${input.role}:${input.catalogRoute}`,
    );
  if (resolverKey !== inferredResolverKey)
    throw new Error(
      `Resolver key ${resolverKey} does not match ${input.role}:${input.catalogRoute}`,
    );
}

function assertUnconditionalDeclaration(
  input: Readonly<{
    role: Role;
    catalogRoute: string;
    resolverKey?: string | undefined;
  }>,
  inferredResolverKey: string | null,
): void {
  if (input.resolverKey !== undefined)
    throw new Error(
      `Unconditional route ${input.role}:${input.catalogRoute} cannot declare a resolver key`,
    );
  if (inferredResolverKey !== null)
    throw new Error(
      `Resolver route ${input.role}:${input.catalogRoute} must use kind=resolver`,
    );
}

export type RouteBindingForProfileInput = Readonly<{
  profile: SeedProfile;
  minimumProfile: SeedProfile;
  kind: RouteKind;
  resolverKey: ResolverKey | null;
  resolverOutcomes: readonly ResolverOutcomeKind[];
  target: "none" | "active" | "published";
  requiredCapability: SeedCapability | null;
  resolvedRoute: string;
  landingRoute: string | undefined;
  profileCapabilities: ProfileCapabilities;
}>;

/**
 * Downstream preflight and matrix code extends this pure identity with the
 * exact expected target and UI state. This boundary never derives either from
 * an observed URL.
 */
export type ResolverOutcomeExpectationExtension = Readonly<{
  identity: ResolverOutcomeIdentity;
  expectedTarget: string;
  expectedUi: string;
}>;

function routeBindingForProfile(
  input: RouteBindingForProfileInput,
): RouteBinding {
  const hasCapability = hasRequiredCapability(input);
  const rationale =
    input.profile === input.minimumProfile
      ? input.requiredCapability
        ? `Smallest profile declaring ${input.requiredCapability}`
        : "Smallest profile for a route without a seed capability"
      : `Profile extends ${input.minimumProfile} and exercises the same route with additional seeded state`;
  if (input.kind === RESOLVER_ROUTE_KIND)
    return hasCapability
      ? resolverAssignedBinding(input, rationale)
      : resolverInapplicableBinding(input);
  return hasCapability
    ? unconditionalAssignedBinding(input, rationale)
    : unconditionalInapplicableBinding(input);
}

export function routeBindingsForProfiles(
  input: Omit<RouteBindingForProfileInput, "profile">,
): readonly RouteBinding[] {
  return SEED_PROFILES.map((profile) =>
    routeBindingForProfile({ ...input, profile }),
  );
}

function hasRequiredCapability(input: RouteBindingForProfileInput): boolean {
  return (
    input.requiredCapability === null ||
    input.profileCapabilities[input.profile].includes(input.requiredCapability)
  );
}

function bindingBase(input: RouteBindingForProfileInput) {
  return {
    profile: input.profile,
    target: input.target,
    requiredCapability: input.requiredCapability,
    resolvedRoute: input.resolvedRoute,
  };
}

function resolverAssignedBinding(
  input: RouteBindingForProfileInput,
  rationale: string,
): RouteBinding {
  if (input.resolverKey === null)
    throw new Error("Resolver route is missing its resolver key");
  return {
    status: "assigned",
    ...bindingBase(input),
    kind: RESOLVER_ROUTE_KIND,
    resolverKey: input.resolverKey,
    resolverOutcomes: input.resolverOutcomes,
    rationale,
  };
}

function unconditionalAssignedBinding(
  input: RouteBindingForProfileInput,
  rationale: string,
): RouteBinding {
  if (input.landingRoute === undefined)
    throw new Error("Unconditional route is missing its landing route");
  return {
    status: "assigned",
    ...bindingBase(input),
    kind: UNCONDITIONAL_ROUTE_KIND,
    landingRoute: input.landingRoute,
    rationale,
  };
}

function resolverInapplicableBinding(
  input: RouteBindingForProfileInput,
): RouteBinding {
  if (input.resolverKey === null)
    throw new Error("Resolver route is missing its resolver key");
  return {
    status: NOT_APPLICABLE_STATUS,
    ...bindingBase(input),
    kind: RESOLVER_ROUTE_KIND,
    resolverKey: input.resolverKey,
    resolverOutcomes: [],
    reason: reasonFor(input),
  };
}

function unconditionalInapplicableBinding(
  input: RouteBindingForProfileInput,
): RouteBinding {
  if (input.landingRoute === undefined)
    throw new Error("Unconditional route is missing its landing route");
  return {
    status: NOT_APPLICABLE_STATUS,
    ...bindingBase(input),
    kind: UNCONDITIONAL_ROUTE_KIND,
    landingRoute: input.landingRoute,
    reason: reasonFor(input),
  };
}

function reasonFor(input: RouteBindingForProfileInput): string {
  return input.requiredCapability
    ? `Profile does not declare required capability ${input.requiredCapability}`
    : NO_CAPABILITY_REASON;
}

export const resolverInapplicableBindingsFor = (
  bindings: readonly RouteBinding[],
  requiredCapability: SeedCapability,
): readonly ResolverOutcomeInapplicable[] =>
  bindings
    .filter((binding) => binding.status === NOT_APPLICABLE_STATUS)
    .map(({ profile }) => resolverInapplicableFor(profile, requiredCapability));

export const resolverOutcomeKindsFor = (
  resolverKey: string,
): readonly ResolverOutcomeKind[] => {
  if (resolverKey !== VIEWER_STATUS_RESOLVER_KEY) {
    throw new Error(`Unknown runtime resolver key: ${resolverKey}`);
  }
  return RESOLVER_OUTCOME_KINDS;
};

export const resolverInapplicableFor = (
  profile: SeedProfile,
  requiredCapability: SeedCapability,
): ResolverOutcomeInapplicable =>
  resolverOutcomeInapplicableSchema.parse({
    profile,
    constraintId: "resolver-profile-capability",
    reason: `Profile does not declare required capability ${requiredCapability}`,
  });

export const freezeResolverOutcomeIdentity = (
  identity: ResolverOutcomeIdentity,
): ResolverOutcomeIdentity =>
  Object.freeze(resolverOutcomeIdentitySchema.parse(identity));

export const bindResolverOutcomeSourceDigest = (
  identity: ResolverOutcomeIdentity,
  sourceDigest: string,
): SourceBoundResolverOutcome =>
  sourceBoundResolverOutcomeSchema.parse({ ...identity, sourceDigest });
