import { describe, expect, it } from "vitest";

import { revealPathFor, revealSurfaceFor } from "../preflight/reveal-path.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../source/contracts.ts";
import type { CampaignMatrixPlan } from "./campaign-matrix.ts";
import {
  finalizeCampaignMatrix,
  MatrixFinalizationError,
  parseFrozenMatrix,
  preflightNavigationStates,
  routeFor,
  serializeFrozenMatrix,
} from "./matrix-finalizer.ts";
import { input, plan, routes, state } from "./matrix-finalizer-fixtures.ts";
import { revealTransitionFor } from "./reveal-transition.ts";

function freezesDeterministicRows(): void {
  const matrix = finalizeCampaignMatrix(input());
  const serialized = serializeFrozenMatrix(matrix);
  const reparsed = parseFrozenMatrix(JSON.parse(serialized));

  expect(reparsed).toEqual(matrix);
  expect(matrix.rows).toHaveLength(matrix.counts.total);
  expect(matrix.inapplicable.some((row) => row.role === "head")).toBe(true);
  expect(
    matrix.inapplicable.some(
      (row) => row.catalogRoute === "/head" && row.role === "head",
    ),
  ).toBe(true);
  expect(matrix.inapplicable.some((row) => row.profile === "demo")).toBe(true);
}

function rejectsChangedPreflight(): void {
  const original = state();
  const altered = {
    state: { ...original, axes: { ...original.axes, lifecycle: "reopened" } },
    controls: [],
    specialized: [],
  } as const;

  expect(() => finalizeCampaignMatrix(input({ preflight: [altered] }))).toThrow(
    "payload changed",
  );
  expect(() => finalizeCampaignMatrix(input({ maxCases: 1 }))).toThrow(
    "finalized cases",
  );
}

function bindsInventoryDigest(): void {
  const inventory = {
    ariaRole: "button",
    accessibleName: "Save",
    enabled: true,
    order: 1,
    domOrderKey: "0001:button:Save:1",
    href: null,
    interactionEffect: null,
  } as const;
  const action = {
    controlKey: "button:Save:1",
    operation: "click" as const,
    safety: "read-only" as const,
    transition: "none" as const,
  };
  const expectedSurface = revealSurfaceFor([
    { controlKey: "button:Save:1", ...inventory },
  ]);
  const transitionFor = (surface: typeof expectedSurface) =>
    revealTransitionFor(action, surface, surface, "/", "/", {
      status: "unchanged",
      beforeDigest: "a".repeat(64),
      afterDigest: "a".repeat(64),
    });
  const control = {
    controlKey: "button:Save:1",
    inventory,
    revealPath: revealPathFor(),
    expectedSurface,
    expectedActionSurface: expectedSurface,
    expectedActionTransition: transitionFor(expectedSurface),
    action,
  };
  const driftedInventory = {
    ...control.inventory,
    accessibleName: "Save draft",
  };
  const driftedSurface = revealSurfaceFor([
    { controlKey: control.controlKey, ...driftedInventory },
  ]);
  const first = finalizeCampaignMatrix(
    input({
      preflight: [{ state: state(), controls: [control], specialized: [] }],
    }),
  );
  const second = finalizeCampaignMatrix(
    input({
      preflight: [
        {
          state: state(),
          controls: [
            {
              ...control,
              inventory: driftedInventory,
              expectedSurface: driftedSurface,
              expectedActionSurface: driftedSurface,
              expectedActionTransition: transitionFor(driftedSurface),
            },
          ],
          specialized: [],
        },
      ],
    }),
  );
  expect(second.digest).not.toBe(first.digest);
}

function preservesFullAxisPlanRows(): void {
  const distinctPlan: CampaignMatrixPlan = {
    ...plan,
    inapplicable: [
      {
        profile: "demo",
        axes: {
          ...state("demo").axes,
          role: "lead",
          route: "lead:/lead",
          lifecycle: "open",
          submission: "draft",
          ownershipDensity: "none",
          permission: "allowed",
          fault: "none",
          controlTransition: "none",
        },
        constraintId: "profile-capability-boundary",
        reason: "profile capability is unavailable",
      },
      {
        profile: "demo",
        axes: {
          ...state("demo").axes,
          role: "head",
          route: "head:/head",
          lifecycle: "published",
          submission: "approved",
          ownershipDensity: "multiple",
          permission: "anonymous",
          fault: "http-5xx",
          controlTransition: "publish",
        },
        constraintId: "profile-capability-boundary",
        reason: "profile capability is unavailable",
      },
    ],
  };
  const matrix = finalizeCampaignMatrix(
    input({
      plan: distinctPlan,
      preflight: preflightNavigationStates(distinctPlan),
    }),
  );
  const planRows = matrix.inapplicable.filter(
    ({ inapplicable }) =>
      inapplicable.constraintId === "profile-capability-boundary",
  );
  const byRoute = new Map(
    planRows.map((row) => [row.catalogRoute, row] as const),
  );

  expect(planRows).toHaveLength(2);
  expect(new Set(planRows.map(({ caseId }) => caseId)).size).toBe(2);
  expect(byRoute.get("/lead")).toMatchObject({
    profile: "demo",
    role: "lead",
    state: {
      profileCapability: "canonical-identities",
      lifecycle: "open",
      submission: "draft",
      ownershipDensity: "none",
      permission: "allowed",
      fault: "none",
      controlTransition: "none",
    },
  });
  expect(byRoute.get("/head")).toMatchObject({
    profile: "demo",
    role: "head",
    state: {
      profileCapability: "canonical-identities",
      lifecycle: "published",
      submission: "approved",
      ownershipDensity: "multiple",
      permission: "anonymous",
      fault: "http-5xx",
      controlTransition: "publish",
    },
  });
}

function bindsNetworkPolicyIntoCaseIdentityAndDigest(): void {
  const baseline = finalizeCampaignMatrix(input());
  const networkPolicy = {
    maxRepeatedApiRequests: 3,
    retryStormThreshold: 5,
    slowRequestThresholdMs: 5000,
    cacheExpectedOperations: ["report.get"],
  } as const;
  const firstRoute = routes[0];
  if (firstRoute === undefined) throw new Error("Fixture route is missing");
  const changed = finalizeCampaignMatrix(
    input({
      routes: [{ ...firstRoute, networkPolicy }, ...routes.slice(1)],
    }),
  );

  expect(baseline.cases[0]?.networkPolicy.cacheExpectedOperations).toEqual([]);
  expect(changed.cases[0]?.networkPolicy.cacheExpectedOperations).toEqual([
    "report.get",
  ]);
  expect(changed.cases[0]?.caseId).not.toBe(baseline.cases[0]?.caseId);
  expect(changed.digest).not.toBe(baseline.digest);
}

function preservesExplicitNullNetworkPolicy(): void {
  const resolved = routeFor(routes, state());

  expect(resolved.resolvedRoute).toBe("/lead");
  expect(resolved.networkPolicy).toBe(NO_ROUTE_CACHE_CONTRACT_POLICY);
}

function rejectsUnknownRoutesDirectly(): void {
  expect(() => routeFor([], state())).toThrow(MatrixFinalizationError);
  expect(() => routeFor([], state())).toThrow(
    "No route declaration for lead:/lead",
  );
}

function rejectsUnknownRoutesInInapplicableRows(): void {
  const [basePlanRow] = plan.inapplicable;
  if (basePlanRow === undefined) throw new Error("Fixture plan row is missing");
  const unknownPlan: CampaignMatrixPlan = {
    ...plan,
    inapplicable: [
      {
        ...basePlanRow,
        axes: { ...basePlanRow.axes, route: "lead:/unknown" },
      },
    ],
  };

  expect(() =>
    finalizeCampaignMatrix(
      input({
        plan: unknownPlan,
        preflight: preflightNavigationStates(unknownPlan),
      }),
    ),
  ).toThrow("No route declaration for lead:/unknown");
}

describe("campaign matrix finalizer", () => {
  it("freezes deterministic rows", freezesDeterministicRows);
  it("rejects changed preflight", rejectsChangedPreflight);
  it("binds inventory into the digest", bindsInventoryDigest);
  it("preserves inapplicable rows", preservesFullAxisPlanRows);
  it(
    "binds network policy into case identity and digest",
    bindsNetworkPolicyIntoCaseIdentityAndDigest,
  );
  it(
    "preserves explicit null as the named no-contract policy",
    preservesExplicitNullNetworkPolicy,
  );
  it("rejects unknown routes directly", rejectsUnknownRoutesDirectly);
  it(
    "rejects unknown routes in inapplicable rows",
    rejectsUnknownRoutesInInapplicableRows,
  );
});
