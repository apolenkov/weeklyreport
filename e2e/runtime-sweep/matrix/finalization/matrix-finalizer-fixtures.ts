import type { CampaignManifest } from "../../source/contracts.ts";
import {
  type CampaignMatrixPlan,
  type CampaignMatrixState,
} from "../campaign-matrix.ts";
import {
  type MatrixFinalizationInput,
  preflightNavigationStates,
} from "../matrix-finalizer.ts";

const SOURCE_SHA_LENGTH = 40;
const DEMO_PROFILE = "demo" as const;
const CANONICAL_IDENTITIES = "canonical-identities" as const;
const SOURCE_SHA = "a".repeat(SOURCE_SHA_LENGTH);

export const state = (
  profile: CampaignMatrixState["profile"] = "minimal",
): CampaignMatrixState => ({
  stateId: `state-${profile}`,
  pairwiseDigest: "pairwise-digest",
  profile,
  axes: {
    role: "lead",
    route: "lead:/lead",
    profileCapability: CANONICAL_IDENTITIES,
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
    profileCapability: [CANONICAL_IDENTITIES],
    lifecycle: ["open"],
    submission: ["draft"],
    ownershipDensity: ["single"],
    permission: ["allowed"],
    fault: ["none"],
    controlTransition: ["none"],
  },
  constraints: [],
};

export const routes: CampaignManifest["routes"] = [
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
        requiredCapability: CANONICAL_IDENTITIES,
        resolvedRoute: "/lead",
        landingRoute: "/lead",
        rationale: "fixture route",
      },
    ],
  },
  {
    role: "head",
    catalogRoute: "/head",
    resolvedRoute: "/head",
    landingRoute: "/head",
    networkPolicy: null,
  },
];

export const plan: CampaignMatrixPlan = {
  states: [state()],
  inapplicable: [
    {
      profile: DEMO_PROFILE,
      axes: state(DEMO_PROFILE).axes,
      constraintId: "profile-capability-boundary",
      reason: "demo profile is intentionally omitted",
    },
  ],
  digest: "plan-digest",
};

export const input = (
  overrides: Partial<MatrixFinalizationInput> = {},
): MatrixFinalizationInput => ({
  sourceSha: SOURCE_SHA,
  declaration,
  plan,
  routes,
  preflight: preflightNavigationStates(plan),
  maxCases: 100_000,
  maxControlsPerSegment: 8192,
  ...overrides,
});
