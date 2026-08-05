import { describe, expect, it } from "vitest";

import type { CampaignManifest } from "../source/contracts.ts";
import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "./campaign-matrix.ts";
import {
  DEFAULT_MAX_CASES,
  DEFAULT_MAX_CONTROLS,
  finalizeCampaignMatrix,
  parseFrozenMatrix,
  preflightNavigationStates,
  serializeFrozenMatrix,
} from "./matrix-finalizer.ts";
import type { MatrixPreflightControl } from "./matrix-finalizer-contract.ts";

const SOURCE_SHA = "a".repeat(40);
const R9_PREFLIGHT_CONTROL_COUNT = 727;

const state = (
  profile: CampaignMatrixState["profile"] = "minimal",
): CampaignMatrixState => ({
  stateId: `state-${profile}`,
  pairwiseDigest: "pairwise-digest",
  profile,
  axes: {
    role: "lead",
    route: "lead:/lead",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
});

const declaration: CampaignManifest["matrixDeclaration"] = {
  generatorSeed: "fixture",
  axes: {
    role: ["lead", "head"],
    route: ["lead:/lead", "head:/head"],
    profileCapability: ["canonical-identities"],
    lifecycle: ["open"],
    submission: ["draft"],
    ownershipDensity: ["single"],
    permission: ["allowed"],
    fault: ["none"],
    controlTransition: ["none"],
  },
  constraints: [],
};

const routes: CampaignManifest["routes"] = [
  {
    role: "lead",
    catalogRoute: "/lead",
    resolvedRoute: "/lead",
    bindings: [
      {
        status: "assigned",
        profile: "minimal",
        target: "none",
        requiredCapability: "canonical-identities",
        resolvedRoute: "/lead",
        rationale: "fixture route",
      },
    ],
  },
];

const plan: CampaignMatrixPlan = {
  states: [state()],
  inapplicable: [
    {
      profile: "demo",
      axes: state("demo").axes,
      constraintId: "profile-capability-boundary",
      reason: "demo profile is intentionally omitted",
    },
  ],
  digest: "plan-digest",
};

const input = (
  overrides: Partial<Parameters<typeof finalizeCampaignMatrix>[0]> = {},
) => ({
  sourceSha: SOURCE_SHA,
  declaration,
  plan,
  routes,
  preflight: preflightNavigationStates(plan),
  ...overrides,
});

const controlsFor = (count: number): readonly MatrixPreflightControl[] =>
  Array.from({ length: count }, (_, index) => {
    const controlKey = `button:fixture-${index}`;
    return {
      controlKey,
      inventory: {
        ariaRole: "button",
        accessibleName: `Fixture ${index}`,
        enabled: true,
        order: index,
        domOrderKey: `${String(index).padStart(4, "0")}:${controlKey}`,
      },
      action: {
        controlKey,
        operation: "click" as const,
        safety: "read-only" as const,
        transition: "none" as const,
      },
    };
  });

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
  const control = {
    controlKey: "button:Save:1",
    inventory: {
      ariaRole: "button",
      accessibleName: "Save",
      enabled: true,
      order: 1,
      domOrderKey: "0001:button:Save:1",
    },
    action: {
      controlKey: "button:Save:1",
      operation: "click" as const,
      safety: "read-only" as const,
      transition: "none" as const,
    },
  };
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
              inventory: { ...control.inventory, accessibleName: "Save draft" },
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

function acceptsObservedPreflightScale(): void {
  const matrix = finalizeCampaignMatrix(
    input({
      preflight: [
        {
          state: state(),
          controls: controlsFor(R9_PREFLIGHT_CONTROL_COUNT),
          specialized: [],
        },
      ],
    }),
  );

  expect([DEFAULT_MAX_CONTROLS, DEFAULT_MAX_CASES]).toEqual([1024, 100_000]);
  expect(Number.isFinite(DEFAULT_MAX_CONTROLS)).toBe(true);
  expect(Number.isFinite(DEFAULT_MAX_CASES)).toBe(true);
  expect(matrix.limits).toEqual({
    maxCases: DEFAULT_MAX_CASES,
    maxControlsPerSegment: DEFAULT_MAX_CONTROLS,
  });
  expect(matrix.counts.executable).toBe(R9_PREFLIGHT_CONTROL_COUNT + 1);
}

describe("campaign matrix finalizer", () => {
  it(
    "freezes deterministic rows and typed inapplicable omissions",
    freezesDeterministicRows,
  );
  it(
    "rejects changed preflight payloads and total-case overflow",
    rejectsChangedPreflight,
  );
  it(
    "binds semantic control inventory into the matrix digest",
    bindsInventoryDigest,
  );
  it(
    "preserves every full-axis plan inapplicable row",
    preservesFullAxisPlanRows,
  );
  it(
    "accepts the observed preflight scale with finite defaults",
    acceptsObservedPreflightScale,
  );
});
