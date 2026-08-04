import { describe, expect, it } from "vitest";

import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "./campaign-matrix.ts";
import type { CampaignManifest } from "./contracts.ts";
import {
  finalizeCampaignMatrix,
  parseFrozenMatrix,
  preflightNavigationStates,
  serializeFrozenMatrix,
} from "./matrix-finalizer.ts";

const SOURCE_SHA = "a".repeat(40);

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
});
