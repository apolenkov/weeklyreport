import { describe, expect, it } from "vitest";

import type { CampaignMatrixState } from "../campaign-matrix.ts";
import {
  matrixCellPath,
  type MatrixLiveControlRoute,
  routeSelectedMatrixStates,
} from "./matrix-live-control.ts";

const state = (
  stateId: string,
  fault: CampaignMatrixState["axes"]["fault"],
  controlTransition: CampaignMatrixState["axes"]["controlTransition"],
): CampaignMatrixState => ({
  stateId,
  pairwiseDigest: "pairwise",
  profile: "minimal",
  axes: {
    role: "lead",
    route: "lead:/lead/report",
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault,
    controlTransition,
  },
});

const isSpecialized = (
  route: MatrixLiveControlRoute,
): route is Extract<MatrixLiveControlRoute, { readonly kind: "specialized" }> =>
  route.kind === "specialized";

describe("matrix live-control routing", () => {
  it("routes every selected cell to execution or typed specialization", () => {
    const routed = routeSelectedMatrixStates({
      runnable: [state("nominal", "none", "none")],
      specialized: [
        state("fault", "http-5xx", "none"),
        state("transition", "none", "submit"),
        state("both", "api-error", "retry"),
      ],
      cases: [],
    });

    expect(routed.map(({ state: candidate }) => candidate.stateId)).toEqual([
      "nominal",
      "fault",
      "transition",
      "both",
    ]);
    expect(routed.map(({ kind }) => kind)).toEqual([
      "runnable",
      "specialized",
      "specialized",
      "specialized",
    ]);
    expect(
      routed.filter(isSpecialized).map(({ specialization }) => specialization),
    ).toEqual(["fault", "control-transition", "fault-and-control-transition"]);
  });

  it("rejects duplicate matrix state identities instead of dropping a cell", () => {
    expect(() =>
      routeSelectedMatrixStates({
        runnable: [state("duplicate", "none", "none")],
        specialized: [state("duplicate", "http-5xx", "none")],
        cases: [],
      }),
    ).toThrow(/duplicate matrix state identity/iu);
  });

  it("keeps live evidence on the exact matrix cell path", () => {
    expect(matrixCellPath("/archive", "minimal", "lead", "cell-1")).toBe(
      "/archive/cells/minimal/lead/cell-1.json",
    );
  });
});
