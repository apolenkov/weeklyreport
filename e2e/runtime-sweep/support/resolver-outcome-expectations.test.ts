import { describe, expect, it } from "vitest";

import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../../prisma/seeds/support/seed-constants.ts";
import type { CatalogRoute } from "../../sweep/catalog-parser.ts";
import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import { routeFor } from "../matrix/matrix-finalizer-contract.ts";
import {
  assertFreshRuntimeManifest,
  type RuntimeMatrixSource,
} from "../matrix/runtime-matrix-manifest.ts";
import { assertResolverOutcomeUi } from "../preflight/preflight-reveal-guards.ts";
import type { DomInventory } from "../replay/dom-inventory.ts";
import type { RouteDeclaration } from "../source/contracts.ts";
import { sha256Hex } from "./ids.ts";
import {
  assertResolverOutcomeExpectation,
  resolverOutcomeExpectationFor,
  resolverOutcomeForState,
  resolverOutcomeGapsFor,
} from "./resolver-outcome-expectations.ts";
import { resolverRecoveryExpectationFor } from "./resolver-recovery-expectations.ts";
import { routeDeclarationFromCatalog } from "./route-binding.ts";

const resolverCatalog: CatalogRoute = {
  route: "/reports/latest",
  access: ["viewer"],
  intents: [
    {
      id: "viewer-live-status",
      intent: "Viewer live status",
      given: "The viewer has current submitted content",
      when: "The viewer opens the status route",
      then: "The current report is shown",
      note: "viewer-live-status",
    },
  ],
};

const route = routeDeclarationFromCatalog(resolverCatalog, "viewer", null);

if (route.kind !== "resolver")
  throw new Error("Resolver fixture lost its resolver discriminator");

const resolverRoute = route;
const SOURCE_DIGEST = "a".repeat(64);

const stateFor = (
  overrides: Partial<CampaignMatrixState["axes"]> = {},
): CampaignMatrixState => {
  const axes = {
    role: "viewer" as const,
    route: "viewer:/reports/latest",
    profileCapability: "submission-contrast" as const,
    lifecycle: "open" as const,
    submission: "submitted" as const,
    ownershipDensity: "single" as const,
    permission: "allowed" as const,
    fault: "none" as const,
    controlTransition: "none" as const,
    ...overrides,
  };
  return {
    stateId: `resolver-${axes.lifecycle}-${axes.permission}`,
    profile: "demo",
    axes,
    pairwiseDigest: sha256Hex(axes),
  };
};

const resolverExpectationFor = (state: CampaignMatrixState) =>
  resolverOutcomeExpectationFor({
    route: resolverRoute,
    state,
    sourceDigest: SOURCE_DIGEST,
  });

const inventoryFor = (
  visibleText: string,
  controls: DomInventory["controls"] = [],
): DomInventory => ({ controls, issues: [], visibleText });

describe("resolver outcome expectations", () => {
  it("derives visible-current from open state and preserves the exact report target", () => {
    const state = stateFor();
    expect(resolverOutcomeForState(state)).toBe("visible-current");
    expect(resolverExpectationFor(state)).toMatchObject({
      identity: {
        outcome: "visible-current",
        profile: "demo",
        stateId: state.stateId,
        stateDigest: state.pairwiseDigest,
        sourceDigest: SOURCE_DIGEST,
      },
      expectedTarget: `/reports/${ACTIVE_REPORT_ID}?source=status&recovery=0`,
      expectedUi: "report-detail:Status Report",
    });
  });

  it("binds query-error recovery to the frozen visible-current report and query", () => {
    const queryError = resolverOutcomeExpectationFor({
      route: resolverRoute,
      state: stateFor(),
      sourceDigest: SOURCE_DIGEST,
      outcome: "query-error",
    });
    const recovery = resolverRecoveryExpectationFor(
      queryError,
      "visible-current",
    );

    expect(recovery).toMatchObject({
      identity: {
        outcome: "visible-current",
        stateId: queryError.identity.stateId,
        stateDigest: queryError.identity.stateDigest,
        sourceDigest: SOURCE_DIGEST,
      },
      expectedTarget: `/reports/${ACTIVE_REPORT_ID}?source=status&recovery=0`,
    });
  });

  it("derives published-fallback from published state without observing the URL", () => {
    const state = stateFor({ lifecycle: "published" });
    expect(resolverOutcomeForState(state)).toBe("published-fallback");
    expect(resolverExpectationFor(state).expectedTarget).toBe(
      `/reports/${PUBLISHED_REPORT_ID}?source=status&recovery=0`,
    );
  });

  it("derives anonymous from the permission boundary with an encoded return query", () => {
    const state = stateFor({ permission: "anonymous" });
    const expectation = resolverExpectationFor(state);
    expect(resolverOutcomeForState(state)).toBe("anonymous");
    expect(expectation.expectedTarget).toBe("/?next=%2Freports%2Flatest");
    expect(expectation.expectedUi).toBe(
      "auth-boundary:Status Reporting System",
    );
  });

  it("rejects invalid source digests and stale state digests", () => {
    const state = stateFor();
    expect(() =>
      resolverOutcomeExpectationFor({
        route: resolverRoute,
        state,
        sourceDigest: "not-a-digest",
      }),
    ).toThrow("valid source digest");
    expect(() =>
      resolverOutcomeExpectationFor({
        route: resolverRoute,
        state: { ...state, pairwiseDigest: "b".repeat(64) },
        sourceDigest: SOURCE_DIGEST,
      }),
    ).toThrow("state digest is stale");
  });

  it("records empty and query-error as typed blocking gaps and blocks a fresh run", () => {
    const gaps = resolverOutcomeGapsFor(resolverRoute, [stateFor()]);
    expect(gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile: "demo",
          outcome: "empty",
          constraintId: "resolver-empty-preparation",
        }),
        expect.objectContaining({
          profile: "demo",
          outcome: "query-error",
          constraintId: "resolver-query-error-preparation",
        }),
      ]),
    );
    const source = {
      resolverOutcomeGaps: gaps,
      legacyBindings: false,
      manifestDigestMatches: true,
    } as unknown as RuntimeMatrixSource;
    expect(() => assertFreshRuntimeManifest(source)).toThrow(
      "blocked resolver outcomes",
    );
    expect(gaps.find(({ outcome }) => outcome === "empty")?.reason).toContain(
      "No deterministic state preparation",
    );
    expect(
      gaps.find(({ outcome }) => outcome === "query-error")?.reason,
    ).toContain("No deterministic query-error fault");
  });

  it("accepts explicit route-local outcomes only when the minimum profile is declared", () => {
    const declarations = [
      {
        kind: "resolver",
        outcome: "empty" as const,
        profile: "demo" as const,
        role: "viewer" as const,
        catalogRoute: "/reports/latest",
      },
      {
        kind: "resolver",
        outcome: "query-error" as const,
        profile: "demo" as const,
        role: "viewer" as const,
        catalogRoute: "/reports/latest",
      },
    ];
    expect(
      resolverOutcomeGapsFor(resolverRoute, [stateFor()], declarations),
    ).toEqual([]);
    expect(
      resolverOutcomeExpectationFor({
        route: resolverRoute,
        state: stateFor(),
        sourceDigest: SOURCE_DIGEST,
        outcome: "empty",
      }),
    ).toMatchObject({
      identity: { outcome: "empty", sourceDigest: SOURCE_DIGEST },
      expectedTarget: "/reports/latest",
    });
  });

  it("rejects missing or stale resolver expectations at matrix and replay boundaries", () => {
    const state = stateFor();
    const expected = resolverExpectationFor(state);
    expect(() => assertResolverOutcomeExpectation(expected, undefined)).toThrow(
      "Missing resolver expected outcome",
    );
    expect(() =>
      assertResolverOutcomeExpectation(expected, {
        ...expected,
        expectedTarget: "/reports/latest",
      }),
    ).toThrow("stale or mismatched");

    const incompleteRoute = {
      ...resolverRoute,
      resolverOutcomes: ["visible-current"],
    } as unknown as RouteDeclaration;
    expect(() =>
      routeFor(
        [incompleteRoute],
        stateFor({ lifecycle: "published" }),
        SOURCE_DIGEST,
      ),
    ).toThrow("does not declare expected outcome");
  });

  it("asserts the exact UI extension for report, auth, empty, and query-error outcomes", () => {
    const controls = [
      {
        role: "button",
        accessibleName: "Try again",
      },
      {
        role: "link",
        accessibleName: "Sign in with corporate SSO",
      },
    ] as unknown as DomInventory["controls"];
    expect(() =>
      assertResolverOutcomeUi(
        resolverExpectationFor(stateFor()),
        inventoryFor("Status Report", controls),
      ),
    ).not.toThrow();
    expect(() =>
      assertResolverOutcomeUi(
        resolverExpectationFor(stateFor({ permission: "anonymous" })),
        inventoryFor("Status Reporting System", controls),
      ),
    ).not.toThrow();
    expect(() =>
      assertResolverOutcomeUi(
        {
          ...resolverExpectationFor(stateFor()),
          identity: {
            ...resolverExpectationFor(stateFor()).identity,
            outcome: "empty",
          },
          expectedUi: "status-empty:There is no report to show yet.",
        },
        inventoryFor("There is no report to show yet."),
      ),
    ).not.toThrow();
    expect(() =>
      assertResolverOutcomeUi(
        {
          ...resolverExpectationFor(stateFor()),
          identity: {
            ...resolverExpectationFor(stateFor()).identity,
            outcome: "query-error",
          },
          expectedUi:
            "status-query-error:Could not load the status report.;retry=Try again",
        },
        inventoryFor("Could not load the status report.", controls),
      ),
    ).not.toThrow();
    expect(() =>
      assertResolverOutcomeUi(
        { ...resolverExpectationFor(stateFor()), expectedUi: "status-empty" },
        inventoryFor("Status Report"),
      ),
    ).toThrow("UI contract is stale");
  });
});
