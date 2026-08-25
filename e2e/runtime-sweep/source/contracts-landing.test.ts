import { describe, expect, it } from "vitest";

import {
  landingRouteSchema,
  RESOLVER_OUTCOME_KINDS,
  resolverOutcomeIdentitySchema,
  routeDeclarationSchema,
  sourceBoundResolverOutcomeSchema,
} from "./contracts.ts";

const routeDeclaration = {
  role: "admin",
  catalogRoute: "/admin/activities",
  resolvedRoute: "/admin/activities",
  landingRoute: "/admin?tab=activities",
  networkPolicy: null,
};

describe("runtime sweep landing URL contracts", () => {
  it("keeps landing URLs relative, exact, and query-capable", () => {
    expect(landingRouteSchema.safeParse("/admin?tab=activities").success).toBe(
      true,
    );
    expect(
      landingRouteSchema.safeParse("https://outside.example/admin").success,
    ).toBe(false);
    expect(landingRouteSchema.safeParse("/admin#activities").success).toBe(
      false,
    );
    expect(
      landingRouteSchema.safeParse("//outside.example/admin").success,
    ).toBe(false);
  });

  it("requires the landing URL in a route declaration", () => {
    expect(routeDeclarationSchema.safeParse(routeDeclaration).success).toBe(
      true,
    );
    const { landingRoute: _landingRoute, ...withoutLanding } = routeDeclaration;
    expect(routeDeclarationSchema.safeParse(withoutLanding).success).toBe(
      false,
    );
  });

  it("keeps resolver entries executable without a synthetic landing URL", () => {
    const resolver = {
      kind: "resolver" as const,
      resolverKey: "viewer-status" as const,
      resolverOutcomes: RESOLVER_OUTCOME_KINDS,
      role: "viewer" as const,
      catalogRoute: "/reports/latest",
      resolvedRoute: "/reports/latest",
      networkPolicy: null,
    };
    expect(routeDeclarationSchema.safeParse(resolver).success).toBe(true);
    expect(
      routeDeclarationSchema.safeParse({
        ...resolver,
        landingRoute: "/reports/published",
      }).success,
    ).toBe(false);
    expect(
      routeDeclarationSchema.safeParse({
        ...resolver,
        resolverOutcomes: ["visible-current"],
      }).success,
    ).toBe(false);
  });

  it("requires the complete resolver outcome set and downstream source binding", () => {
    const identity = {
      resolverKey: "viewer-status" as const,
      outcome: "visible-current" as const,
      profile: "demo" as const,
      stateId: "viewer-status-visible-current",
      stateDigest: "a".repeat(64),
    };
    expect(resolverOutcomeIdentitySchema.safeParse(identity).success).toBe(
      true,
    );
    expect(
      sourceBoundResolverOutcomeSchema.safeParse({
        ...identity,
        sourceDigest: "b".repeat(64),
      }).success,
    ).toBe(true);
    expect(sourceBoundResolverOutcomeSchema.safeParse(identity).success).toBe(
      false,
    );
  });
});
