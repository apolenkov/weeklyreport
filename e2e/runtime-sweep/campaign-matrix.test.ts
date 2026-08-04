import { describe, expect, it } from "vitest";

import { compileCampaignMatrix } from "./campaign-matrix.ts";
import type {
  MatrixDeclaration,
  RouteDeclaration,
  SeedProfileBinding,
} from "./contracts.ts";
import {
  CONTROL_TRANSITIONS,
  FAULT_MODES,
  LIFECYCLE_STATES,
  OWNERSHIP_DENSITIES,
  PERMISSION_BOUNDARIES,
  SEED_CAPABILITIES,
  SUBMISSION_STATES,
} from "./contracts.ts";

const SOURCE_SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const declaration: MatrixDeclaration = {
  generatorSeed: "fixture",
  axes: {
    role: ["head"],
    route: ["head:/head/report"],
    profileCapability: ["canonical-identities"],
    lifecycle: ["open", "published"],
    submission: ["draft", "submitted"],
    ownershipDensity: ["single"],
    permission: ["head", "owner"],
    fault: ["none", "http-5xx"],
    controlTransition: ["none", "publish"],
  },
  constraints: [],
};
const route: RouteDeclaration = {
  role: "head",
  catalogRoute: "/head/report",
  resolvedRoute: "/head/report",
  bindings: [
    {
      status: "assigned",
      profile: "minimal",
      target: "none",
      requiredCapability: null,
      resolvedRoute: "/head/report",
      rationale: "fixture",
    },
    ...(["demo", "full", "stress"] as const).map((profile) => ({
      status: "not-applicable" as const,
      profile,
      target: "none" as const,
      requiredCapability: null,
      resolvedRoute: "/head/report",
      reason: "fixture",
    })),
  ],
};
const profile: SeedProfileBinding = {
  profile: "minimal",
  definition: {
    purpose: "fixture",
    capabilities: ["canonical-identities"],
    stableIds: { activeReport: "report-1" },
    counts: {
      users: { min: 1, max: 1 },
      projects: { min: 1, max: 1 },
      reports: { min: 1, max: 1 },
      sections: { min: 1, max: 1 },
      items: { min: 1, max: 1 },
    },
  },
  digest: DIGEST,
};

const activeRoute: RouteDeclaration = {
  role: "lead",
  catalogRoute: "/lead/report/[reportId]",
  resolvedRoute: "/lead/report/active",
  bindings: [
    {
      status: "assigned",
      profile: "minimal",
      target: "active",
      requiredCapability: "editable-active-report",
      resolvedRoute: "/lead/report/active",
      rationale: "fixture",
    },
    ...(["demo", "full", "stress"] as const).map((profile) => ({
      status: "not-applicable" as const,
      profile,
      target: "active" as const,
      requiredCapability: "editable-active-report" as const,
      resolvedRoute: "/lead/report/active",
      reason: "fixture",
    })),
  ],
};

const activeProfile: SeedProfileBinding = {
  ...profile,
  definition: {
    ...profile.definition,
    capabilities: ["canonical-identities", "editable-active-report"],
  },
};

const fullActiveRoute: RouteDeclaration = {
  ...activeRoute,
  bindings: activeRoute.bindings?.map((binding) =>
    binding.profile === "full"
      ? {
          ...binding,
          status: "assigned" as const,
          rationale: "full runtime fixture",
        }
      : {
          ...binding,
          status: "not-applicable" as const,
          reason: "full runtime fixture",
        },
  ),
};

const fullActiveProfile: SeedProfileBinding = {
  ...activeProfile,
  profile: "full",
  definition: {
    ...activeProfile.definition,
    capabilities: SEED_CAPABILITIES,
  },
};

describe("campaign runtime matrix", () => {
  it("retains the canonical nominal state when pairwise selection omits it", () => {
    const plan = compileCampaignMatrix({
      sourceSha: SOURCE_SHA,
      declaration: {
        generatorSeed: "runtime-sweep-v1",
        axes: {
          role: ["lead"],
          route: ["lead:/lead/report/[reportId]"],
          profileCapability: SEED_CAPABILITIES,
          lifecycle: LIFECYCLE_STATES,
          submission: SUBMISSION_STATES,
          ownershipDensity: OWNERSHIP_DENSITIES,
          permission: PERMISSION_BOUNDARIES,
          fault: FAULT_MODES,
          controlTransition: CONTROL_TRANSITIONS,
        },
        constraints: [],
      },
      routes: [fullActiveRoute],
      seedProfiles: [fullActiveProfile],
    });

    expect(
      plan.states.some(
        ({ profile, axes }) =>
          profile === "full" &&
          axes.lifecycle === "open" &&
          axes.submission === "draft" &&
          axes.ownershipDensity === "single" &&
          axes.permission === "allowed" &&
          axes.fault === "none" &&
          axes.controlTransition === "none",
      ),
    ).toBe(true);
  });

  it("is deterministic and prunes impossible role, lifecycle, and fault rows", () => {
    const input = {
      sourceSha: SOURCE_SHA,
      declaration,
      routes: [route],
      seedProfiles: [profile],
    };
    const first = compileCampaignMatrix(input);
    const second = compileCampaignMatrix(input);

    expect(second).toEqual(first);
    expect(first.states.length).toBeGreaterThan(0);
    expect(first.states.every(({ profile }) => profile === "minimal")).toBe(
      true,
    );
    expect(first.states.some(({ axes }) => axes.permission === "owner")).toBe(
      false,
    );
    expect(
      first.states.some(
        ({ axes }) =>
          axes.lifecycle === "published" &&
          axes.controlTransition === "publish",
      ),
    ).toBe(false);
    expect(
      first.states.some(
        ({ axes }) =>
          axes.fault === "http-5xx" && axes.controlTransition === "none",
      ),
    ).toBe(false);
    expect(
      first.states.every(
        ({ axes }) =>
          axes.lifecycle === "open" &&
          axes.submission === "draft" &&
          axes.ownershipDensity === "single" &&
          axes.permission === "allowed" &&
          axes.fault === "none" &&
          axes.controlTransition === "none",
      ),
    ).toBe(true);
  });

  it("keeps report-bound states pairwise while marking unsupported profile values", () => {
    const plan = compileCampaignMatrix({
      sourceSha: SOURCE_SHA,
      declaration: {
        ...declaration,
        axes: {
          ...declaration.axes,
          role: ["lead"],
          route: ["lead:/lead/report/[reportId]"],
          permission: [
            "allowed",
            "owner",
            "non-owner",
            "anonymous",
            "forbidden",
          ],
        },
      },
      routes: [activeRoute],
      seedProfiles: [activeProfile],
    });

    expect(plan.states.length).toBeGreaterThan(0);
    expect(
      plan.states.every(
        ({ axes }) =>
          axes.fault === "none" && axes.controlTransition === "none",
      ),
    ).toBe(true);
    expect(
      plan.states.some(
        ({ axes }) =>
          axes.lifecycle === "published" ||
          axes.submission !== "draft" ||
          axes.ownershipDensity === "multiple",
      ),
    ).toBe(false);
    expect(
      plan.inapplicable.some(
        ({ constraintId }) => constraintId === "profile-capability-boundary",
      ),
    ).toBe(true);
  });

  it("rejects a route whose profile scope was not bound", () => {
    expect(() =>
      compileCampaignMatrix({
        sourceSha: SOURCE_SHA,
        declaration,
        routes: [{ ...route, bindings: undefined }],
        seedProfiles: [profile],
      }),
    ).toThrow("route has no bindings");
  });
});
