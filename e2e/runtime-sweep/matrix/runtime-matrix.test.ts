import { describe, expect, it } from "vitest";

import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../source/contracts.ts";
import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "./campaign-matrix.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import {
  actorForPermission,
  selectRuntimeStates,
  stateAxesFromMatrix,
} from "./runtime-matrix.ts";

const state = (
  permission: CampaignMatrixState["axes"]["permission"],
  fault: CampaignMatrixState["axes"]["fault"],
  controlTransition: CampaignMatrixState["axes"]["controlTransition"],
): CampaignMatrixState => ({
  stateId: `${permission}-${fault}-${controlTransition}`,
  pairwiseDigest: "pairwise",
  profile: "minimal",
  axes: {
    role: "lead",
    route: "lead:/lead/report",
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission,
    fault,
    controlTransition,
  },
});

const plan = (states: readonly CampaignMatrixState[]): CampaignMatrixPlan => ({
  states,
  inapplicable: [],
  digest: "digest",
});

const frozenCase = (candidate: CampaignMatrixState): MatrixExecutableCase => ({
  caseId: `case-${candidate.stateId}`,
  stateId: candidate.stateId,
  sourceSha: "a".repeat(40),
  profile: candidate.profile,
  role: candidate.axes.role,
  catalogRoute: candidate.axes.route.slice(
    candidate.axes.route.indexOf(":") + 1,
  ),
  resolvedRoute: candidate.axes.route,
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
  state: {
    profileCapability: candidate.axes.profileCapability,
    lifecycle: candidate.axes.lifecycle,
    submission: candidate.axes.submission,
    ownershipDensity: candidate.axes.ownershipDensity,
    permission: candidate.axes.permission,
    fault: candidate.axes.fault,
    controlTransition: candidate.axes.controlTransition,
  },
  kind: "executable",
  execution: {
    kind: "navigation",
    action: {
      controlKey: `route:${candidate.axes.route}`,
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  },
});

describe("runtime matrix actors", () => {
  it("maps each permission boundary to a seeded actor", () => {
    const actor = actorForPermission("non-owner", "lead");

    expect(actor).toMatchObject({
      id: "a0000000-0000-4000-8000-000000000012",
      role: "lead",
      email: "maria@customreport.local",
    });
  });

  it("maps allowed sessions to the canonical actor for every route role", () => {
    const actors = [
      actorForPermission("allowed", "lead"),
      actorForPermission("allowed", "head"),
      actorForPermission("allowed", "admin"),
      actorForPermission("allowed", "viewer"),
    ];

    expect(actors).toEqual([
      {
        id: "a0000000-0000-4000-8000-000000000011",
        role: "lead",
        email: "lead1@customreport.local",
      },
      {
        id: "a0000000-0000-4000-8000-000000000099",
        role: "head",
        email: "head@customreport.local",
      },
      {
        id: "a0000000-0000-4000-8000-000000000097",
        role: "admin",
        email: "admin@customreport.local",
      },
      {
        id: "a0000000-0000-4000-8000-000000000098",
        role: "viewer",
        email: "viewer@customreport.local",
      },
    ]);
  });
});

describe("runtime matrix frozen state selection", () => {
  it("keeps faults and transitions out of the navigation-only lane", () => {
    const candidates = [
      state("allowed", "none", "none"),
      state("allowed", "http-5xx", "none"),
      state("owner", "none", "submit"),
    ];
    const frozenCandidates = candidates
      .filter((_, index) => index !== 1)
      .map(frozenCase);
    const selected = selectRuntimeStates(
      plan(candidates),
      "minimal",
      frozenCandidates,
    );

    expect(selected.runnable.map(({ stateId }) => stateId)).toEqual([
      "allowed-none-none",
    ]);
    expect(selected.specialized).toHaveLength(1);
    expect(selected.specialized[0]?.stateId).toBe("owner-none-submit");
    expect(selected.runnable).not.toContainEqual(
      expect.objectContaining({ stateId: "allowed-http-5xx-none" }),
    );
  });

  it("projects matrix identity into the typed coverage state", () => {
    const axes = stateAxesFromMatrix(state("owner", "none", "none"));

    expect(axes).toEqual({
      profileCapability: "editable-active-report",
      lifecycle: "open",
      submission: "draft",
      ownershipDensity: "single",
      permission: "owner",
      fault: "none",
      controlTransition: "none",
    });
  });
});
