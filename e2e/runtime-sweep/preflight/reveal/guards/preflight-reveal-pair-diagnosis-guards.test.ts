import { describe, expect, it } from "vitest";

import { revealPathFor } from "../../reveal-path.ts";
import {
  assertRevealControlCapacity,
  type RevealBranch,
} from "../interaction/preflight-reveal-branches.ts";
import { independentDisclosureReductionFor } from "./preflight-reveal-canonicalization-diagnosis.ts";
import {
  branchWithoutPaths,
  contextFor,
  diagnosisFor,
  fixtures,
  surfaceFor,
  surfaceWithControlFor,
  untrustedSurfaceFor,
} from "./preflight-reveal-pair-diagnosis-fixtures.ts";

describe("pair-level reveal diagnosis guards", () => {
  it("fails closed for context, prefix, order, material, and target drift", () => {
    const fixture = fixtures();
    const branch = fixture.pairs[0];
    const reverse = fixture.pairs[1];
    if (branch === undefined || reverse === undefined)
      throw new Error("Fixture pair is missing");
    const context = contextFor();
    const knownBranches = [
      ...fixture.singles,
      ...fixture.pairs,
    ] as readonly RevealBranch[];
    const replaceReverse = (
      replacement: RevealBranch,
    ): readonly RevealBranch[] => [
      ...branchWithoutPaths(knownBranches, [reverse.path.digest]),
      replacement,
    ];
    const prefixMismatch = {
      ...reverse,
      path: revealPathFor(reverse.path.steps, "/admin?different-prefix"),
    };
    const urlMismatch = { ...reverse, url: "/admin?different-url" };
    const materialMismatch = {
      ...reverse,
      surface: surfaceFor(["a"]),
    };
    const unionSurface = surfaceFor(["a", "b", "c", "d"]);
    const unionCurrent = { ...branch, surface: unionSurface };
    const unionReverse = { ...reverse, surface: unionSurface };
    const targetDrift = {
      ...reverse,
      path: revealPathFor(
        reverse.path.steps.map((step, index) =>
          index === 0
            ? {
                ...step,
                before: surfaceWithControlFor(step.before, "b", {
                  ariaControls: "panel-b-drift",
                }),
              }
            : step,
        ),
        reverse.path.initialUrl,
      ),
    };
    const cases = [
      {
        label: "context mismatch",
        branch,
        knownBranches,
        expectedContext: { ...context, role: "viewer" },
        reason: "context-not-bound",
      },
      {
        label: "prefix mismatch",
        branch,
        knownBranches: replaceReverse(prefixMismatch),
        expectedContext: context,
        reason: "reverse-order-not-found",
      },
      {
        label: "reverse order absent",
        branch,
        knownBranches: branchWithoutPaths(knownBranches, [reverse.path.digest]),
        expectedContext: context,
        reason: "reverse-order-not-found",
      },
      {
        label: "single order absent",
        branch,
        knownBranches: branchWithoutPaths(knownBranches, [
          fixture.singles[1]?.path.digest ?? "missing-single",
        ]),
        expectedContext: context,
        reason: "single-order-not-found",
      },
      {
        label: "url mismatch",
        branch,
        knownBranches: replaceReverse(urlMismatch),
        expectedContext: context,
        reason: "pair-material-or-url-mismatch",
      },
      {
        label: "material mismatch",
        branch,
        knownBranches: replaceReverse(materialMismatch),
        expectedContext: context,
        reason: "pair-material-or-url-mismatch",
      },
      {
        label: "union mismatch",
        branch: unionCurrent,
        knownBranches: [
          ...branchWithoutPaths(knownBranches, [
            branch.path.digest,
            reverse.path.digest,
          ]),
          unionReverse,
        ],
        expectedContext: context,
        reason: "pair-union-mismatch",
      },
      {
        label: "target drift",
        branch,
        knownBranches: replaceReverse(targetDrift),
        expectedContext: context,
        reason: "reverse-order-not-found",
      },
    ] as const;
    for (const testCase of cases) {
      expect(diagnosisFor(context, testCase), testCase.label).toMatchObject({
        evidenceComplete: false,
        reason: testCase.reason,
      });
    }
  });

  it("rejects untrusted markers and unchanged expanded state", () => {
    const fixture = fixtures();
    const branch = fixture.pairs[0];
    if (branch === undefined) throw new Error("Fixture pair is missing");
    const context = contextFor();
    const knownBranches = [
      ...fixture.singles,
      ...fixture.pairs,
    ] as readonly RevealBranch[];
    const markerGuard = {
      ...branch,
      path: revealPathFor(
        branch.path.steps.map((step, index) =>
          index === 0
            ? {
                ...step,
                before: untrustedSurfaceFor(step.before),
                after: untrustedSurfaceFor(step.after),
              }
            : step,
        ),
        branch.path.initialUrl,
      ),
    };
    const expandedGuard = {
      ...branch,
      path: revealPathFor(
        branch.path.steps.map((step, index) =>
          index === 0
            ? {
                ...step,
                after: surfaceWithControlFor(step.after, "a", {
                  ariaExpanded: false,
                }),
              }
            : step,
        ),
        branch.path.initialUrl,
      ),
    };
    for (const candidate of [markerGuard, expandedGuard]) {
      expect(
        diagnosisFor(context, {
          branch: candidate,
          knownBranches,
          expectedContext: context,
        }),
      ).toMatchObject({
        evidenceComplete: false,
        reason: "pair-suffix-not-found",
      });
    }
  });

  it("keeps the hard capacity gate and reduction parity unchanged", () => {
    const fixture = fixtures();
    const branch = fixture.pairs[0];
    if (branch === undefined) throw new Error("Fixture pair is missing");
    const knownBranches = [
      ...fixture.singles,
      ...fixture.pairs,
    ] as readonly RevealBranch[];
    const context = contextFor();
    expect(
      diagnosisFor(context, {
        branch,
        knownBranches,
        expectedContext: context,
      }),
    ).toMatchObject({
      evidenceComplete: true,
      computedSavings: 2,
      requiredSavings: 0,
      thresholdSatisfied: true,
      reason: "diagnostic-complete",
    });
    expect(independentDisclosureReductionFor({ branch, knownBranches })).toBe(
      false,
    );
    expect(() => assertRevealControlCapacity(8192, 8192)).not.toThrow();
    expect(() => assertRevealControlCapacity(8193, 8192)).toThrow(/exceeded/u);
  });
});
