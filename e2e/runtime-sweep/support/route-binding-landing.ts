import {
  landingRouteSchema,
  type ResolverKey,
  type ResolverOutcomeInapplicable,
  type ResolverOutcomeKind,
  type Role,
  type RouteBinding,
  type RouteBindingTarget,
  type RouteDeclarationInput,
  type RouteKind,
  routeUrlSchema,
  type SeedCapability,
  type SeedProfile,
} from "../source/contracts.ts";
import { resolverInapplicableBindingsFor } from "./resolver-outcome-contract.ts";

const REPORT_ID_PLACEHOLDER = "[reportId]";

export type RouteBindingDeclaration = Pick<
  RouteDeclarationInput,
  | "role"
  | "catalogRoute"
  | "landingRoute"
  | "allowsCurrentLive"
  | "kind"
  | "resolverKey"
>;

interface RouteBindingResultCommon {
  readonly role: Role;
  readonly catalogRoute: string;
  readonly allowsCurrentLive: boolean;
  readonly target: RouteBindingTarget;
  readonly requiredCapability: SeedCapability | null;
  readonly minimumProfile: SeedProfile;
  readonly resolvedRoute: string;
  readonly bindings: readonly RouteBinding[];
}

export type RouteBindingResult =
  | (RouteBindingResultCommon & {
      readonly kind: "unconditional";
      readonly resolverKey?: never;
      readonly resolverOutcomes: readonly [];
      readonly landingRoute: string;
    })
  | (RouteBindingResultCommon & {
      readonly kind: "resolver";
      readonly resolverKey: ResolverKey;
      readonly resolverOutcomes: readonly ResolverOutcomeKind[];
      readonly landingRoute?: never;
      readonly inapplicable: readonly ResolverOutcomeInapplicable[];
    });

function boundReportId(
  catalogRoute: string,
  target: RouteBindingTarget,
  resolveRoute: (route: string, routeTarget: RouteBindingTarget) => string,
): string | null {
  if (!catalogRoute.includes(REPORT_ID_PLACEHOLDER)) return null;
  const resolved = resolveRoute(REPORT_ID_PLACEHOLDER, target);
  if (
    resolved === "" ||
    resolved.includes(REPORT_ID_PLACEHOLDER) ||
    resolved.includes("/") ||
    resolved.includes("?") ||
    resolved.includes("#") ||
    /\s/u.test(resolved)
  )
    return null;
  return resolved;
}

function hasBoundReportIdPathSegment(route: string, reportId: string): boolean {
  const pathname = route.split("?", 1)[0] ?? route;
  return pathname.split("/").includes(reportId);
}

export function resolveLandingRoute(
  catalogRoute: string,
  landingRoute: string | undefined,
  target: RouteBindingTarget,
  resolveRoute: (route: string, routeTarget: RouteBindingTarget) => string,
): string {
  const template = landingRoute ?? catalogRoute;
  if (!landingRouteSchema.safeParse(template).success)
    throw new Error(`Invalid landing route declaration: ${template}`);
  if (
    catalogRoute.includes(REPORT_ID_PLACEHOLDER) &&
    landingRoute !== undefined &&
    !landingRoute.includes(REPORT_ID_PLACEHOLDER)
  ) {
    const resolvedReportId = boundReportId(catalogRoute, target, resolveRoute);
    if (
      resolvedReportId === null ||
      !hasBoundReportIdPathSegment(landingRoute, resolvedReportId)
    )
      throw new Error(
        `Dynamic catalog route ${catalogRoute} must preserve ${REPORT_ID_PLACEHOLDER} in its landing route`,
      );
  }
  const resolved = resolveRoute(template, target);
  if (!routeUrlSchema.safeParse(resolved).success)
    throw new Error(`Resolved landing route is invalid: ${resolved}`);
  return resolved;
}

export function routeBindingResultForKind(input: {
  readonly common: RouteBindingResultCommon;
  readonly kind: RouteKind;
  readonly resolverKey: ResolverKey | null;
  readonly resolverOutcomes: readonly ResolverOutcomeKind[];
  readonly landingRoute: string | undefined;
  readonly requiredCapability: SeedCapability | null;
}): RouteBindingResult {
  if (input.kind === "resolver") {
    if (input.resolverKey === null)
      throw new Error("Resolver route is missing its resolver key");
    return {
      ...input.common,
      kind: "resolver",
      resolverKey: input.resolverKey,
      resolverOutcomes: input.resolverOutcomes,
      inapplicable: resolverInapplicableBindingsFor(
        input.common.bindings,
        input.requiredCapability ?? "submission-contrast",
      ),
    };
  }
  if (input.landingRoute === undefined)
    throw new Error("Unconditional route is missing its landing route");
  return {
    ...input.common,
    kind: "unconditional",
    resolverOutcomes: [],
    landingRoute: input.landingRoute,
  };
}

export function bindingForProfileOrThrow(
  binding: RouteBindingResult,
  profile: SeedProfile,
): Extract<RouteBinding, { status: "assigned" }> {
  const assignment = binding.bindings.find(
    (candidate): candidate is Extract<RouteBinding, { status: "assigned" }> =>
      candidate.profile === profile && candidate.status === "assigned",
  );
  if (assignment) return assignment;
  const selected = binding.bindings.find(
    (candidate) => candidate.profile === profile,
  );
  const reason =
    selected?.status === "not-applicable" ? selected.reason : "unknown binding";
  throw new Error(
    `${binding.role} ${binding.catalogRoute} is not assigned to ${profile}: ${reason}`,
  );
}
