import { describe, expect, it } from "vitest";

import {
  CONTROL_TRANSITIONS,
  FAULT_MODES,
  LIFECYCLE_STATES,
  OWNERSHIP_DENSITIES,
  PERMISSION_BOUNDARIES,
  SEED_CAPABILITIES,
  SUBMISSION_STATES,
} from "../source/contracts.ts";
import {
  type AxisValues,
  compilePairwiseMatrix,
  MATRIX_AXIS_NAMES,
} from "./matrix.ts";

const axes: AxisValues = {
  role: ["lead", "head"],
  route: ["/lead/report", "/head/review"],
  profileCapability: ["canonical-identities", "ownership"],
  lifecycle: ["open", "published"],
  submission: ["draft", "submitted"],
  ownershipDensity: ["single", "multiple"],
  permission: ["allowed", "forbidden"],
  fault: ["none", "http-5xx"],
  controlTransition: ["none", "submit"],
};

const input = {
  sourceSha: "a".repeat(40),
  generatorSeed: "fixed-seed",
  axes,
};

const highCardinalityInput = {
  sourceSha: "a".repeat(40),
  generatorSeed: "high-cardinality",
  axes: {
    role: ["lead"],
    route: ["lead:/lead/report"],
    profileCapability: SEED_CAPABILITIES,
    lifecycle: LIFECYCLE_STATES,
    submission: SUBMISSION_STATES,
    ownershipDensity: OWNERSHIP_DENSITIES,
    permission: PERMISSION_BOUNDARIES,
    fault: FAULT_MODES,
    controlTransition: CONTROL_TRANSITIONS,
  } satisfies AxisValues,
};

function pairKeys(
  matrix: ReturnType<typeof compilePairwiseMatrix>,
): ReadonlySet<string> {
  return new Set(
    matrix.states.flatMap((state) =>
      MATRIX_AXIS_NAMES.flatMap((left, index) =>
        MATRIX_AXIS_NAMES.slice(index + 1).map(
          (right) =>
            `${left}=${state.axes[left]}|${right}=${state.axes[right]}`,
        ),
      ),
    ),
  );
}

describe("runtime sweep pairwise compiler", () => {
  it("reproduces ordered states and digest for identical input", () => {
    const first = compilePairwiseMatrix(input);
    const second = compilePairwiseMatrix(input);
    expect(second).toEqual(first);
    expect(first.states.map((state) => state.stateId)).toEqual(
      second.states.map((state) => state.stateId),
    );
  });

  it("covers every declared value pair and reports the same pair set", () => {
    const matrix = compilePairwiseMatrix(input);
    expect(new Set(matrix.coveredPairs)).toEqual(pairKeys(matrix));
    for (const left of MATRIX_AXIS_NAMES) {
      for (const right of MATRIX_AXIS_NAMES.slice(
        MATRIX_AXIS_NAMES.indexOf(left) + 1,
      )) {
        for (const leftValue of axes[left]) {
          for (const rightValue of axes[right]) {
            const pair = `${left}=${leftValue}|${right}=${rightValue}`;
            expect(matrix.coveredPairs).toContain(pair);
          }
        }
      }
    }
  });

  it("changes the digest when the source or matrix manifest drifts", () => {
    const sourceDrift = compilePairwiseMatrix({
      ...input,
      sourceSha: "b".repeat(40),
    });
    const axisDrift = compilePairwiseMatrix({
      ...input,
      axes: { ...axes, route: ["/lead/report", "/head/review", "/admin"] },
    });
    expect(sourceDrift.digest).not.toBe(compilePairwiseMatrix(input).digest);
    expect(axisDrift.digest).not.toBe(compilePairwiseMatrix(input).digest);
  });

  it("retains a typed reason for constrained combinations", () => {
    const matrix = compilePairwiseMatrix({
      ...input,
      constraints: [
        {
          id: "forbidden-publish",
          reason: "forbidden users cannot publish",
          check: (state) =>
            !(
              state.permission === "forbidden" &&
              state.controlTransition === "submit"
            ),
        },
      ],
    });
    expect(
      matrix.inapplicable.some(
        (entry) => entry.constraintId === "forbidden-publish",
      ),
    ).toBe(true);
  });

  it("prunes an impossible branch before later axes expand", () => {
    const matrix = compilePairwiseMatrix({
      ...input,
      constraints: [
        {
          id: "lead-owner",
          reason: "Only lead may use owner permission",
          check: ({ role, permission }) =>
            permission !== "owner" || role === "lead",
          checkPartial: ({ role, permission }) =>
            permission !== "owner" || role === undefined || role === "lead",
        },
      ],
    });

    expect(
      matrix.states.some(
        ({ axes }) => axes.role === "viewer" && axes.permission === "owner",
      ),
    ).toBe(false);
  });

  it("keeps the full declared axis set pairwise without Cartesian explosion", () => {
    const matrix = compilePairwiseMatrix(highCardinalityInput);

    expect(matrix.states.length).toBeLessThanOrEqual(256);
    expect(matrix.inapplicable).toHaveLength(0);
    expect(matrix.coveredPairs).toHaveLength(1432);
  });
});
