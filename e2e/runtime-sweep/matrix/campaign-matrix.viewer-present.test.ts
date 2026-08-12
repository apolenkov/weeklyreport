import { describe, expect, it } from "vitest";

import type {
  MatrixDeclaration,
  RouteDeclaration,
  SeedProfileBinding,
} from "../source/contracts.ts";
import { SEED_CAPABILITIES } from "../source/contracts.ts";
import { compileCampaignMatrix } from "./campaign-matrix.ts";
import {
  VIEWER_PUBLISHED_ROUTE,
  VIEWER_PUBLISHED_ROUTE_NONCURRENT_LIFECYCLE,
} from "./campaign-matrix-constraints.ts";

const SOURCE_SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const route: RouteDeclaration = {
  role: "viewer",
  catalogRoute: "/reports/[reportId]/present",
  resolvedRoute: "/reports/published",
  landingRoute: "/reports/published",
  networkPolicy: null,
  bindings: [
    {
      status: "assigned",
      profile: "full",
      target: "published",
      requiredCapability: "published-period",
      resolvedRoute: "/reports/published",
      landingRoute: "/reports/published",
      rationale: "fixture",
    },
  ],
};
const profile: SeedProfileBinding = {
  profile: "full",
  definition: {
    purpose: "fixture",
    capabilities: SEED_CAPABILITIES,
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
const declaration: MatrixDeclaration = {
  generatorSeed: "viewer-published-fixture",
  axes: {
    role: ["viewer"],
    route: [VIEWER_PUBLISHED_ROUTE],
    profileCapability: ["published-period"],
    lifecycle: ["open", "reopened", "published", "archived"],
    submission: ["draft"],
    ownershipDensity: ["single"],
    permission: ["allowed"],
    fault: ["none"],
    controlTransition: ["none"],
  },
  constraints: [],
};

describe("viewer published-target campaign matrix", () => {
  it("marks non-current open and reopened rows inapplicable", () => {
    const plan = compileCampaignMatrix({
      sourceSha: SOURCE_SHA,
      declaration,
      routes: [route],
      seedProfiles: [profile],
    });
    const rejected = plan.inapplicable.filter(
      ({ constraintId }) =>
        constraintId === VIEWER_PUBLISHED_ROUTE_NONCURRENT_LIFECYCLE,
    );

    expect(rejected).toHaveLength(2);
    expect(rejected.map(({ axes }) => axes.lifecycle)).toEqual([
      "open",
      "reopened",
    ]);
    expect(
      plan.states.some(({ axes }) =>
        ["open", "reopened"].includes(axes.lifecycle),
      ),
    ).toBe(false);
    expect(plan.states.some(({ axes }) => axes.lifecycle === "published")).toBe(
      true,
    );
    expect(plan.states.some(({ axes }) => axes.lifecycle === "archived")).toBe(
      true,
    );
  });
});
