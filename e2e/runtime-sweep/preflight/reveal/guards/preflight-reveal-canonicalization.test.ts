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
import { independentDisclosureReductionFor } from "./preflight-reveal-canonicalization-diagnosis.ts";

const unchanged = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};

const controlFor = (
  key: string,
  target: string,
  expanded: boolean,
  disclosureIndependence?: "source-bound-row-local",
): DomControlObservation => {
  const independence = disclosureIndependence ?? "source-bound-row-local";
  return {
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
    disclosureIndependence: independence,
  };
};

const inventoryFor = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

const actionFor = (key: string): Action => ({
  controlKey: key,
  operation: "click",
  safety: "read-only",
  transition: "open",
});

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
  const finalSurface = surfaces.at(-1);
  if (finalSurface === undefined)
    throw new Error("fixture final surface missing");
  return {
    path: revealPathFor(steps, "/admin"),
    inventory: inventoryFor([]),
    surface: finalSurface,
    url: "/admin",
  };
};

const renamedSurfaceFor = (surface: RevealSurface): RevealSurface =>
  revealSurfaceFor(
    surface.controls.map((control) =>
      control.ariaExpanded === true
        ? {
            ...control,
            controlKey: `hide-${control.controlKey}`,
            accessibleName: `Hide ${control.accessibleName}`,
          }
        : control,
    ),
  );

const renamedBranchFor = (branch: RevealBranch): RevealBranch => {
  const steps = branch.path.steps.map((step) => ({
    ...step,
    before: renamedSurfaceFor(step.before),
    after: renamedSurfaceFor(step.after),
  }));
  const surface = renamedSurfaceFor(branch.surface);
  return {
    ...branch,
    path: revealPathFor(steps, branch.path.initialUrl),
    surface,
  };
};

const fixtures = () => {
  const root = surfaceFor({ a: false, b: false, c: false });
  const single = (key: string): RevealBranch => {
    const states: Record<string, boolean> = { a: false, b: false, c: false };
    states[key] = true;
    return branchFor([key], [root, surfaceFor(states)]);
  };
  const pair = (first: string, second: string): RevealBranch => {
    const firstStates: Record<string, boolean> = {
      a: false,
      b: false,
      c: false,
    };
    firstStates[first] = true;
    const finalStates: Record<string, boolean> = { ...firstStates };
    finalStates[second] = true;
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

describe("independent disclosure canonicalization", () => {
  it("reduces a proven independent union after both pair orders exist", () => {
    const fixture = fixtures();

    expect(
      independentDisclosureReductionFor({
        branch: fixture.candidate,
        knownBranches: [...fixture.singles, ...fixture.pairs],
      }),
    ).toBe(true);
  });

  it("keeps the branch exhaustive when a pair order is missing", () => {
    const fixture = fixtures();
    const firstPair = fixture.pairs[0];
    if (firstPair === undefined) throw new Error("fixture pair is missing");

    expect(
      independentDisclosureReductionFor({
        branch: fixture.candidate,
        knownBranches: [...fixture.singles, firstPair],
      }),
    ).toBe(false);
  });

  it("rejects overlapping targets and a newly coupled surface control", () => {
    const fixture = fixtures();
    const overlapping = fixture.candidate.path.steps.map((step, index) =>
      index === 2
        ? {
            ...step,
            before: {
              ...step.before,
              controls: step.before.controls.map((control) =>
                control.controlKey === "c"
                  ? { ...control, ariaControls: "panel-a" }
                  : control,
              ),
            },
          }
        : step,
    );
    const coupled = branchFor(
      ["a", "b", "c"],
      [
        fixture.candidate.path.steps[0]?.before ?? surfaceFor({}),
        fixture.singles[0]?.surface ?? surfaceFor({}),
        fixture.pairs[0]?.surface ?? surfaceFor({}),
        revealSurfaceFor([
          controlFor("a", "panel-a", true),
          controlFor("b", "panel-b", true),
          controlFor("c", "panel-c", true),
          controlFor("row", "panel-row", false),
        ]),
      ],
    );
    const overlappingBranch: RevealBranch = {
      ...fixture.candidate,
      path: revealPathFor(overlapping, "/admin"),
    };

    expect(
      independentDisclosureReductionFor({
        branch: overlappingBranch,
        knownBranches: [...fixture.singles, ...fixture.pairs],
      }),
    ).toBe(false);
    expect(
      independentDisclosureReductionFor({
        branch: coupled,
        knownBranches: [...fixture.singles, ...fixture.pairs],
      }),
    ).toBe(false);
  });

  it("matches a source-bound disclosure when its accessible name changes", () => {
    const fixture = fixtures();
    const candidate = renamedBranchFor(fixture.candidate);

    expect(
      independentDisclosureReductionFor({
        branch: candidate,
        knownBranches: [
          ...fixture.singles.map(renamedBranchFor),
          ...fixture.pairs.map(renamedBranchFor),
        ],
      }),
    ).toBe(true);
  });
});
