import { describe, expect, it } from "vitest";

import { ACTIVE_REPORT_ID } from "../../../prisma/seeds/support/seed-constants.ts";
import type { ResolverOutcomeExpectation } from "../support/resolver-outcome-expectations.ts";
import {
  assertInitialLanding,
  assertRoutePath,
  sameRevealRoutePath,
} from "./preflight-reveal-guards.ts";

const ACTIVITIES_ROUTE = {
  resolvedRoute: "/admin/activities",
  landingRoute: "/admin?tab=activities",
} as const;

const RESOLVER_EXPECTATION: ResolverOutcomeExpectation = {
  identity: {
    resolverKey: "viewer-status",
    outcome: "visible-current",
    profile: "demo",
    stateId: "resolver-visible-current",
    stateDigest: "a".repeat(64),
    sourceDigest: "b".repeat(64),
  },
  expectedTarget: `/reports/${ACTIVE_REPORT_ID}?source=status&recovery=0`,
  expectedUi: "report-detail:Status Report",
};

describe("preflight redirect landing guards", () => {
  it("accepts the exact R113 activities landing and uses its pathname boundary", () => {
    expect(
      assertInitialLanding(
        ACTIVITIES_ROUTE,
        "http://127.0.0.1:3205/admin?tab=activities",
        "http://127.0.0.1:3205",
      ),
    ).toBe("/admin?tab=activities");
    expect(sameRevealRoutePath(ACTIVITIES_ROUTE, "/admin?tab=products")).toBe(
      true,
    );
  });

  it("rejects a redirect that settles at a different exact target", () => {
    expect(() =>
      assertInitialLanding(
        ACTIVITIES_ROUTE,
        "http://127.0.0.1:3205/admin?tab=settings",
        "http://127.0.0.1:3205",
      ),
    ).toThrow(/expected=\/admin\?tab=activities/);
  });

  it("rejects a missing landing declaration instead of using the live URL", () => {
    expect(() =>
      assertInitialLanding(
        { resolvedRoute: "/admin/activities" },
        "http://127.0.0.1:3205/admin",
        "http://127.0.0.1:3205",
      ),
    ).toThrow(/lacks an exact landing URL declaration/);
  });

  it("rejects a matching path and query on a foreign origin", () => {
    expect(() =>
      assertInitialLanding(
        ACTIVITIES_ROUTE,
        "https://foreign.example/admin?tab=activities",
        "http://127.0.0.1:3205",
      ),
    ).toThrow(/declared landing origin/);
  });

  it("rejects a later action that leaves the landing pathname", () => {
    expect(() => assertRoutePath(ACTIVITIES_ROUTE, "/reports")).toThrow(
      /left nominal route pathname/,
    );
  });

  it("uses the source-bound resolver target and rejects a synthetic landing URL", () => {
    const route = {
      resolvedRoute: "/reports/latest",
      expectedOutcome: RESOLVER_EXPECTATION,
    };
    expect(
      assertInitialLanding(
        route,
        `http://127.0.0.1:3205${RESOLVER_EXPECTATION.expectedTarget}`,
        "http://127.0.0.1:3205",
      ),
    ).toBe(RESOLVER_EXPECTATION.expectedTarget);
    expect(() =>
      assertInitialLanding(
        { ...route, landingRoute: "/reports/published" },
        "http://127.0.0.1:3205/reports/published",
        "http://127.0.0.1:3205",
      ),
    ).toThrow("static synthetic landing URL");
  });
});
