import { describe, expect, it } from "vitest";

import { revealPathFor } from "../../reveal-path.ts";
import type { RevealBranch } from "../interaction/preflight-reveal-branches.ts";
import { independentDisclosureReductionFor } from "./preflight-reveal-canonicalization-diagnosis.ts";
import {
  fixtures,
  surfaceWithControlFor,
} from "./preflight-reveal-pair-diagnosis-fixtures.ts";

const withFirstAfter = (
  pair: RevealBranch,
  patch: Partial<RevealBranch["surface"]["controls"][number]>,
): RevealBranch => ({
  ...pair,
  path: revealPathFor(
    pair.path.steps.map((step, index) =>
      index === 0
        ? {
            ...step,
            after: surfaceWithControlFor(step.after, "a", patch),
          }
        : step,
    ),
    pair.path.initialUrl,
  ),
});

describe("canonicalization production proof guards", () => {
  it("rejects invalid intermediate surfaces in both pair orders", () => {
    const fixture = fixtures();
    for (const pairIndex of [0, 1]) {
      const pair = fixture.pairs[pairIndex];
      if (pair === undefined) throw new Error("Fixture pair is missing");
      const remainingPairs = fixture.pairs.filter(
        (_, index) => index !== pairIndex,
      );
      for (const invalidPair of [
        withFirstAfter(pair, { disclosureIndependence: undefined }),
        withFirstAfter(pair, { keyboardFocusScope: "active-modal" }),
      ]) {
        expect(
          independentDisclosureReductionFor({
            branch: fixture.candidate,
            knownBranches: [...fixture.singles, invalidPair, ...remainingPairs],
          }),
        ).toBe(false);
      }
    }
  });

  it("rejects a proof branch prepared from a different semantic position", () => {
    const fixture = fixtures();
    const single = fixture.singles[0];
    if (single === undefined) throw new Error("Fixture single is missing");
    const foreignRootSingle = {
      ...single,
      path: revealPathFor(
        single.path.steps.map((step, index) =>
          index === 0
            ? {
                ...step,
                before: surfaceWithControlFor(step.before, "a", {
                  order: 99,
                  domOrderKey: "foreign-root:a",
                }),
              }
            : step,
        ),
        single.path.initialUrl,
      ),
    };
    expect(
      independentDisclosureReductionFor({
        branch: fixture.candidate,
        knownBranches: [
          foreignRootSingle,
          ...fixture.singles.slice(1),
          ...fixture.pairs,
        ],
      }),
    ).toBe(false);
  });
});
