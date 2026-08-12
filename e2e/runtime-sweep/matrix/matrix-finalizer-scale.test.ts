import { expect, test } from "vitest";

import { revealPathFor, revealSurfaceFor } from "../preflight/reveal-path.ts";
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
  serializeFrozenMatrix,
} from "./matrix-finalizer.ts";
import type { MatrixPreflightControl } from "./matrix-finalizer-contract.ts";
import { revealTransitionFor } from "./reveal-transition.ts";

const SOURCE_SHA = "a".repeat(40);
const OBSERVED_CONTROL_COUNT = 727;
const state: CampaignMatrixState = {
  stateId: "state-minimal",
  pairwiseDigest: "pairwise-digest",
  profile: "minimal",
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
};
const plan: CampaignMatrixPlan = {
  states: [state],
  inapplicable: [],
  digest: "plan-digest",
};
const declaration: CampaignManifest["matrixDeclaration"] = {
  generatorSeed: "scale-fixture",
  axes: {
    role: ["lead"],
    route: ["lead:/lead"],
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
    landingRoute: "/lead",
    networkPolicy: null,
    bindings: [
      {
        status: "assigned",
        profile: "minimal",
        target: "none",
        requiredCapability: "canonical-identities",
        resolvedRoute: "/lead",
        landingRoute: "/lead",
        rationale: "scale fixture route",
      },
    ],
  },
];

const controls = (): readonly MatrixPreflightControl[] => {
  const inventories = Array.from(
    { length: OBSERVED_CONTROL_COUNT },
    (_, index) => {
      const controlKey = `button:fixture-${index}`;
      return {
        controlKey,
        inventory: {
          ariaRole: "button",
          accessibleName: `Fixture ${index}`,
          enabled: true,
          order: index,
          domOrderKey: `${String(index).padStart(4, "0")}:${controlKey}`,
          href: null,
          interactionEffect: null,
        },
      } as const;
    },
  );
  const expectedSurface = revealSurfaceFor(
    inventories.map(({ controlKey, inventory }) => ({
      controlKey,
      ...inventory,
    })),
  );
  return inventories.map(({ controlKey, inventory }) => {
    const action = {
      controlKey,
      operation: "click" as const,
      safety: "read-only" as const,
      transition: "none" as const,
    };
    return {
      controlKey,
      inventory,
      revealPath: revealPathFor(),
      expectedSurface,
      expectedActionSurface: expectedSurface,
      expectedActionTransition: revealTransitionFor(
        action,
        expectedSurface,
        expectedSurface,
        "/",
        "/",
        {
          status: "unchanged",
          beforeDigest: "a".repeat(64),
          afterDigest: "a".repeat(64),
        },
      ),
      action,
    };
  });
};

const mutationControl = (
  interactionEffect: "client-only" | "mutation-required" | "missing",
): MatrixPreflightControl => {
  const controlKey = "button:Add%20Group:1";
  const surfaceEffect =
    interactionEffect === "missing" ? null : interactionEffect;
  const inventory = {
    ariaRole: "button",
    accessibleName: "Add Group",
    enabled: true,
    order: 1,
    domOrderKey: "0001:button:Add Group:1",
    href: null,
    ...(interactionEffect === "missing" ? {} : { interactionEffect }),
  };
  const expectedSurface = revealSurfaceFor([
    { controlKey, ...inventory, interactionEffect: surfaceEffect },
  ]);
  return {
    controlKey,
    inventory,
    action: {
      controlKey,
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
    revealPath: revealPathFor([], "/lead"),
    expectedSurface,
    expectedActionTransition: null,
    expectedActionSurface: null,
  };
};

const finalizationInputFor = (
  interactionEffect: "client-only" | "mutation-required" | "missing",
) => ({
  sourceSha: SOURCE_SHA,
  declaration,
  plan,
  routes,
  preflight: [
    { state, controls: [mutationControl(interactionEffect)], specialized: [] },
  ],
});

// Full-suite workers contend for CPU; the isolated production-scale case
// completes in under two seconds but can exceed Vitest's default under load.
const SCALE_TEST_TIMEOUT_MS = 15_000;

test(
  "accepts observed control scale without duplicating reveal data",
  () => {
    const matrix = finalizeCampaignMatrix({
      sourceSha: SOURCE_SHA,
      declaration,
      plan,
      routes,
      preflight: [{ state, controls: controls(), specialized: [] }],
    });
    expect(matrix.counts.executable).toBe(OBSERVED_CONTROL_COUNT + 1);
    expect(matrix.revealPaths).toHaveLength(1);
    expect(matrix.revealSurfaces).toHaveLength(1);
    expect(matrix.revealTransitions).toHaveLength(OBSERVED_CONTROL_COUNT);
    expect(matrix.limits).toEqual({
      maxCases: DEFAULT_MAX_CASES,
      maxControlsPerSegment: DEFAULT_MAX_CONTROLS,
    });
  },
  SCALE_TEST_TIMEOUT_MS,
);

test("accepts an exact mutation-required button without a reveal transition", () => {
  const matrix = finalizeCampaignMatrix(
    finalizationInputFor("mutation-required"),
  );

  expect(() =>
    parseFrozenMatrix(JSON.parse(serializeFrozenMatrix(matrix))),
  ).not.toThrow();
});

test.each(["missing", "client-only"] as const)(
  "rejects a mutation button with a %s interaction effect",
  (interactionEffect) => {
    expect(() =>
      finalizeCampaignMatrix(finalizationInputFor(interactionEffect)),
    ).toThrow(/has no frozen transition/iu);
  },
);
