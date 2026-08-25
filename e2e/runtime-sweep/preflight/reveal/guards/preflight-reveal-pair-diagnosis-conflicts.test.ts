import { describe, expect, it } from "vitest";

import { revealPathFor } from "../../reveal-path.ts";
import {
  contextFor,
  diagnosisFor,
  fixtures,
  surfaceFor,
} from "./preflight-reveal-pair-diagnosis-fixtures.ts";

describe("pair-level reveal order conflict guards", () => {
  it("keeps duplicate and conflicting orders ordinary", () => {
    const fixture = fixtures();
    const branch = fixture.pairs[0];
    const reverse = fixture.pairs[1];
    const single = fixture.singles[0];
    if (branch === undefined || reverse === undefined || single === undefined)
      throw new Error("Fixture order is missing");
    const context = contextFor();
    const knownBranches = [...fixture.singles, ...fixture.pairs];
    const duplicateReverse = {
      ...reverse,
      path: revealPathFor(
        reverse.path.steps.map((step, index) =>
          index === reverse.path.steps.length - 1
            ? {
                ...step,
                nonMutation: {
                  status: "unchanged" as const,
                  beforeDigest: "e".repeat(64),
                  afterDigest: "e".repeat(64),
                },
              }
            : step,
        ),
        reverse.path.initialUrl,
      ),
    };
    const conflictingReverse = {
      ...reverse,
      path: revealPathFor(
        reverse.path.steps.map((step, index) =>
          index === reverse.path.steps.length - 1
            ? { ...step, after: surfaceFor(["a", "b", "d"]) }
            : step,
        ),
        reverse.path.initialUrl,
      ),
      surface: surfaceFor(["a", "b", "d"]),
    };
    const duplicateSingle = {
      ...single,
      path: revealPathFor(
        single.path.steps.map((step) => ({
          ...step,
          nonMutation: {
            status: "unchanged" as const,
            beforeDigest: "f".repeat(64),
            afterDigest: "f".repeat(64),
          },
        })),
        single.path.initialUrl,
      ),
    };
    const cases = [
      {
        label: "duplicate reverse order",
        knownBranches: [...knownBranches, duplicateReverse],
        reason: "reverse-order-conflict",
      },
      {
        label: "conflicting reverse order",
        knownBranches: [...knownBranches, conflictingReverse],
        reason: "reverse-order-conflict",
      },
      {
        label: "duplicate single order",
        knownBranches: [...knownBranches, duplicateSingle],
        reason: "single-order-conflict",
      },
    ] as const;
    for (const testCase of cases) {
      expect(
        diagnosisFor(context, {
          branch,
          knownBranches: testCase.knownBranches,
          expectedContext: context,
        }),
        testCase.label,
      ).toMatchObject({
        evidenceComplete: false,
        reason: testCase.reason,
      });
    }
  });
});
