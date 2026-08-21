import { describe, expect, it } from "vitest";

import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import {
  revealPathFor,
  revealStepFor,
  type RevealSurface,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type { RevealBranch } from "../interaction/preflight-reveal-branches.ts";
import {
  independentDisclosureReductionDiagnosisFor,
  independentDisclosureReductionFor,
} from "./preflight-reveal-canonicalization.ts";

const unchanged = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};

const controlFor = (
  key: string,
  target: string,
  expanded: boolean,
  disclosureIndependence:
    "source-bound-row-local" | undefined = "source-bound-row-local",
): DomControlObservation => ({
  controlKey: key,
  domOrderKey: `${key}:0001`,
  order: 1,
  role: "button",
  accessibleName: key,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls: target,
  ariaExpanded: expanded,
  disclosureIndependence,
});

const actionFor = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "open",
});

const inventoryFor = (
  controls: readonly DomControlObservation[] = [],
): DomInventory => ({ controls, issues: [] });

const surfaceFor = (states: Readonly<Record<string, boolean>>): RevealSurface =>
  revealSurfaceFor(
    Object.entries(states).map(([key, expanded]) =>
      controlFor(key, `panel-${key}`, expanded),
    ),
  );

const branchFor = (
  keys: readonly string[],
  surfaces: readonly RevealSurface[],
): RevealBranch => {
  const steps = keys.map((key, index) => {
    const before = surfaces[index];
    const after = surfaces[index + 1];
    if (before === undefined || after === undefined)
      throw new Error("fixture surface is missing");
    return revealStepFor(
      actionFor(key),
      before,
      after,
      "/admin",
      "/admin",
      unchanged,
    );
  });
  const surface = surfaces.at(-1);
  if (surface === undefined) throw new Error("fixture final surface missing");
  return {
    path: revealPathFor(steps, "/admin"),
    inventory: inventoryFor(),
    surface,
    url: "/admin",
  };
};

const fixtures = () => {
  const root = surfaceFor({ a: false, b: false, c: false });
  const single = (key: string): RevealBranch => {
    const states = { a: false, b: false, c: false };
    states[key as keyof typeof states] = true;
    return branchFor([key], [root, surfaceFor(states)]);
  };
  const pair = (first: string, second: string): RevealBranch => {
    const firstStates = { a: false, b: false, c: false };
    firstStates[first as keyof typeof firstStates] = true;
    const finalStates = { ...firstStates };
    finalStates[second as keyof typeof finalStates] = true;
    return branchFor(
      [first, second],
      [root, surfaceFor(firstStates), surfaceFor(finalStates)],
    );
  };
  const candidate = branchFor(
    ["a", "b", "c"],
    [
      root,
      surfaceFor({ a: true, b: false, c: false }),
      surfaceFor({ a: true, b: true, c: false }),
      surfaceFor({ a: true, b: true, c: true }),
    ],
  );
  return {
    candidate,
    singles: [single("a"), single("b"), single("c")],
    pairs: [
      pair("a", "b"),
      pair("b", "a"),
      pair("a", "c"),
      pair("c", "a"),
      pair("b", "c"),
      pair("c", "b"),
    ],
  };
};

describe("independent disclosure diagnosis", () => {
  it("emits an exact deterministic reason for every outcome", () => {
    const fixture = fixtures();
    const known = [...fixture.singles, ...fixture.pairs];
    const firstSingle = fixture.singles[0];
    const firstPair = fixture.pairs[0];
    if (firstSingle === undefined || firstPair === undefined)
      throw new Error("fixture branch is missing");

    const duplicateSteps = ["a", "b", "c"].map((key) =>
      revealStepFor(
        actionFor(key),
        revealSurfaceFor([controlFor(key, "panel-duplicate", false)]),
        revealSurfaceFor([controlFor(key, "panel-duplicate", true)]),
        "/admin",
        "/admin",
        unchanged,
      ),
    );
    const duplicateTarget: RevealBranch = {
      ...fixture.candidate,
      path: revealPathFor(duplicateSteps, "/admin"),
    };
    const untrusted: RevealBranch = {
      ...fixture.candidate,
      path: revealPathFor(
        fixture.candidate.path.steps.map((step) => ({
          ...step,
          before: revealSurfaceFor(
            step.before.controls.map((control) => ({
              ...control,
              disclosureIndependence: undefined,
            })),
          ),
          after: revealSurfaceFor(
            step.after.controls.map((control) => ({
              ...control,
              disclosureIndependence: undefined,
            })),
          ),
        })),
        "/admin",
      ),
    };
    const unionMismatch = branchFor(
      ["a", "b", "c"],
      [
        fixture.candidate.path.steps[0]?.before ?? surfaceFor({}),
        surfaceFor({ a: true, b: false, c: false }),
        surfaceFor({ a: true, b: true, c: false }),
        surfaceFor({ a: true, b: true, c: true, d: true }),
      ],
    );
    const singleConflict = { ...firstSingle, url: "/other" };
    const cases = [
      [firstSingle, known, "depth-too-shallow", false],
      [untrusted, known, "step-not-eligible", false],
      [duplicateTarget, known, "bindings-not-unique", false],
      [fixture.candidate, [], "single-branch-missing", false],
      [
        fixture.candidate,
        [singleConflict, ...fixture.singles.slice(1), ...fixture.pairs],
        "single-branch-material-or-url-mismatch",
        false,
      ],
      [unionMismatch, known, "union-mismatch", false],
      [
        fixture.candidate,
        [...fixture.singles, firstPair],
        "pair-order-missing-or-mismatch",
        false,
      ],
      [fixture.candidate, known, "reduction-proven", true],
    ] as const;

    for (const [branch, knownBranches, reason, eligible] of cases) {
      const diagnosis = independentDisclosureReductionDiagnosisFor({
        branch,
        knownBranches,
      });
      expect(diagnosis.reason).toBe(reason);
      expect(diagnosis.eligible).toBe(eligible);
      expect(independentDisclosureReductionFor({ branch, knownBranches })).toBe(
        eligible,
      );
    }
  });
});
