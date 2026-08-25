import { describe, expect, it } from "vitest";

import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../../prisma/seeds/support/seed-constants.ts";
import type { CatalogRoute } from "../../sweep/catalog-parser.ts";
import { routeDeclarationSchema } from "../source/contracts.ts";
import {
  bindResolverOutcomeSourceDigest,
  freezeResolverOutcomeIdentity,
  resolverOutcomeKindsFor,
  VIEWER_STATUS_RESOLVER_KEY,
} from "./resolver-outcome-contract.ts";
import {
  bindCatalogRoute,
  bindingForProfileOrThrow,
  bindRouteDeclaration,
  routeDeclarationFromCatalog,
} from "./route-binding.ts";

const route = (
  value: string,
  role: CatalogRoute["access"][number] = "viewer",
  note = "",
  landing?: string,
): CatalogRoute => ({
  route: value,
  ...(landing === undefined ? {} : { landing }),
  access: [role],
  intents: [
    {
      id: "fixture",
      intent: "Fixture route",
      given: "Fixture state",
      when: "The route is opened",
      then: "The route renders",
      note,
    },
  ],
});

describe("runtime route binding", () => {
  it("assigns every published-capable profile for archive report routes", () => {
    const binding = bindCatalogRoute(
      route("/reports/[reportId]", "head"),
      "head",
    );

    expect(binding.target).toBe("published");
    expect(binding.requiredCapability).toBe("published-period");
    expect(binding.minimumProfile).toBe("demo");
    expect(binding.resolvedRoute).toBe(`/reports/${PUBLISHED_REPORT_ID}`);
    expect(binding.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "not-applicable",
          profile: "minimal",
          resolvedRoute: `/reports/${PUBLISHED_REPORT_ID}`,
        }),
        expect.objectContaining({ status: "assigned", profile: "demo" }),
        expect.objectContaining({ status: "assigned", profile: "full" }),
        expect.objectContaining({ status: "assigned", profile: "stress" }),
      ]),
    );
    expect(() => bindingForProfileOrThrow(binding, "minimal")).toThrow(
      "does not declare required capability published-period",
    );
  });

  it("binds viewer live status only to profiles with visible submitted content", () => {
    const catalog = route(
      "/reports/[reportId]",
      "viewer",
      "viewer-live-status: current editable period live",
    );
    const binding = bindCatalogRoute(catalog, "viewer");

    expect(binding.target).toBe("active");
    expect(binding.requiredCapability).toBe("submission-contrast");
    expect(binding.minimumProfile).toBe("demo");
    expect(binding.resolvedRoute).toBe(`/reports/${ACTIVE_REPORT_ID}`);
    expect(binding.bindings[0]).toMatchObject({
      status: "not-applicable",
      profile: "minimal",
      target: "active",
    });
    expect(binding.bindings.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "assigned", profile: "demo" }),
        expect.objectContaining({ status: "assigned", profile: "full" }),
        expect.objectContaining({ status: "assigned", profile: "stress" }),
      ]),
    );
  });

  it("keeps the viewer status resolver executable without an exact landing declaration", () => {
    const binding = bindCatalogRoute(
      route(
        "/reports/latest",
        "viewer",
        "viewer-live-status: current editable period live",
      ),
      "viewer",
    );

    expect(binding.resolvedRoute).toBe("/reports/latest");
    expect(binding.kind).toBe("resolver");
    expect(binding.resolverKey).toBe(VIEWER_STATUS_RESOLVER_KEY);
    expect(binding.landingRoute).toBeUndefined();
    expect(binding.resolverOutcomes).toEqual([
      "visible-current",
      "published-fallback",
      "empty",
      "query-error",
      "anonymous",
    ]);
    expect(binding.requiredCapability).toBe("submission-contrast");
    expect(binding.minimumProfile).toBe("demo");
    expect(binding.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile: "minimal",
          status: "not-applicable",
          resolvedRoute: "/reports/latest",
          kind: "resolver",
          resolverKey: VIEWER_STATUS_RESOLVER_KEY,
          resolverOutcomes: [],
        }),
        expect.objectContaining({
          profile: "demo",
          status: "assigned",
          resolvedRoute: "/reports/latest",
        }),
        expect.objectContaining({
          profile: "full",
          status: "assigned",
          resolvedRoute: "/reports/latest",
        }),
        expect.objectContaining({
          profile: "stress",
          status: "assigned",
          resolvedRoute: "/reports/latest",
        }),
      ]),
    );
  });

  it("keeps a viewer published route on the published id when the oracle is silent", () => {
    const binding = bindCatalogRoute(route("/reports/[reportId]"), "viewer");

    expect(binding.target).toBe("published");
    expect(binding.resolvedRoute).toBe(`/reports/${PUBLISHED_REPORT_ID}`);
    expect(binding.minimumProfile).toBe("demo");
  });

  it("writes the same typed bindings that the manifest consumes", () => {
    const declaration = routeDeclarationFromCatalog(
      route("/head/report/[reportId]", "head"),
      "head",
      null,
    );

    expect(declaration.bindings).toHaveLength(4);
    expect(declaration.resolvedRoute).toBe(`/head/report/${ACTIVE_REPORT_ID}`);
    expect(declaration.bindings?.map(({ profile }) => profile)).toEqual([
      "minimal",
      "demo",
      "full",
      "stress",
    ]);
  });

  it("carries an exact static landing URL through every profile binding", () => {
    const binding = bindCatalogRoute(
      route("/admin/activities", "admin", "", "/admin?tab=activities"),
      "admin",
    );

    expect(binding.resolvedRoute).toBe("/admin/activities");
    expect(binding.landingRoute).toBe("/admin?tab=activities");
    expect(binding.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ landingRoute: "/admin?tab=activities" }),
      ]),
    );
  });

  it("resolves a dynamic landing with the same bound report id", () => {
    const binding = bindCatalogRoute(
      route(
        "/reports/[reportId]/present",
        "viewer",
        "",
        "/reports/[reportId]?mode=slides",
      ),
      "viewer",
    );

    expect(binding.resolvedRoute).toBe(
      `/reports/${PUBLISHED_REPORT_ID}/present`,
    );
    expect(binding.landingRoute).toBe(
      `/reports/${PUBLISHED_REPORT_ID}?mode=slides`,
    );
    expect(bindingForProfileOrThrow(binding, "demo").landingRoute).toBe(
      `/reports/${PUBLISHED_REPORT_ID}?mode=slides`,
    );
  });

  it("rebinds an already-resolved dynamic landing idempotently", () => {
    const first = routeDeclarationFromCatalog(
      route("/head/report/[reportId]", "head"),
      "head",
      null,
    );

    const rebound = bindRouteDeclaration({
      role: first.role,
      catalogRoute: first.catalogRoute,
      landingRoute: first.landingRoute,
      allowsCurrentLive: first.allowsCurrentLive ?? false,
    });

    expect(rebound.resolvedRoute).toBe(first.resolvedRoute);
    expect(rebound.landingRoute).toBe(first.landingRoute);
  });

  it("rebinds a cross-prefix dynamic alias with the same report id", () => {
    const first = bindCatalogRoute(
      route(
        "/head/report/[reportId]",
        "head",
        "",
        "/reports/[reportId]/present",
      ),
      "head",
    );

    const rebound = bindRouteDeclaration({
      role: first.role,
      catalogRoute: first.catalogRoute,
      landingRoute: first.landingRoute,
      allowsCurrentLive: first.allowsCurrentLive,
    });

    expect(rebound.landingRoute).toBe(`/reports/${ACTIVE_REPORT_ID}/present`);
  });

  it("rejects a dynamic alias landing that drops the bound report placeholder", () => {
    expect(() =>
      bindCatalogRoute(
        route(
          "/reports/[reportId]/present",
          "viewer",
          "",
          "/reports/latest?mode=slides",
        ),
        "viewer",
      ),
    ).toThrow(/must preserve \[reportId\]/);
  });

  it("rejects a resolved dynamic alias with a different report id", () => {
    expect(() =>
      bindRouteDeclaration({
        role: "head",
        catalogRoute: "/head/report/[reportId]",
        landingRoute: `/reports/${PUBLISHED_REPORT_ID}`,
      }),
    ).toThrow(/must preserve \[reportId\]/);
  });

  it("rejects a known static alias when its landing declaration is missing", () => {
    expect(() =>
      bindCatalogRoute(route("/admin/activities", "admin"), "admin"),
    ).toThrow(/requires an exact landing route declaration/);
  });

  it("rejects a resolver that tries to claim one static landing URL", () => {
    expect(() =>
      bindRouteDeclaration({
        role: "viewer",
        catalogRoute: "/reports/latest",
        landingRoute: "/reports/published",
      }),
    ).toThrow(/cannot declare a static landing route/);
  });

  it("rejects a resolver key on an unknown route", () => {
    expect(() =>
      bindRouteDeclaration({
        role: "viewer",
        catalogRoute: "/reports",
        kind: "resolver",
        resolverKey: VIEWER_STATUS_RESOLVER_KEY,
      }),
    ).toThrow(/Unknown resolver route/);
  });

  it("emits a resolver declaration without a route-level landing field", () => {
    const declaration = routeDeclarationFromCatalog(
      route("/reports/latest"),
      "viewer",
      null,
    );
    expect(declaration.kind).toBe("resolver");
    expect(declaration.resolverKey).toBe(VIEWER_STATUS_RESOLVER_KEY);
    expect(Object.hasOwn(declaration, "landingRoute")).toBe(false);
    expect(routeDeclarationSchema.safeParse(declaration).success).toBe(true);
  });

  it("binds source identity only after a resolver state is frozen", () => {
    const identity = freezeResolverOutcomeIdentity({
      resolverKey: VIEWER_STATUS_RESOLVER_KEY,
      outcome: "published-fallback",
      profile: "demo",
      stateId: "viewer-status-published-fallback",
      stateDigest: "a".repeat(64),
    });
    expect(
      bindResolverOutcomeSourceDigest(identity, "b".repeat(64)),
    ).toMatchObject({
      ...identity,
      sourceDigest: "b".repeat(64),
    });
    expect(resolverOutcomeKindsFor(VIEWER_STATUS_RESOLVER_KEY)).toHaveLength(5);
  });
});
