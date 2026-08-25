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
import { pairReductionDiagnosisFor } from "./preflight-reveal-pair-diagnosis.ts";
import type { RevealReductionContext } from "./preflight-reveal-reduction-context.ts";

const unchanged = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};

const controlFor = (
  key: string,
  target: string,
  expanded: boolean,
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
  disclosureIndependence: "source-bound-row-local",
});

const actionFor = (controlKey: string): Action => ({
  controlKey,
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
  const surface = surfaces.at(-1);
  if (surface === undefined) throw new Error("fixture final surface missing");
  return {
    path: revealPathFor(steps, "/admin"),
    inventory: { controls: [], issues: [] } satisfies DomInventory,
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

const untrustedSurfaceFor = (surface: RevealSurface): RevealSurface =>
  revealSurfaceFor(
    surface.controls.map((control) => ({
      ...control,
      disclosureIndependence: undefined,
    })),
  );

const contextFor = (): RevealReductionContext => ({
  campaignId: "campaign-e657",
  sourceSha: "a".repeat(40),
  sourceTree: "b".repeat(40),
  treeDigest: "c".repeat(64),
  sourceDigest: "d".repeat(64),
  planDigest: "e".repeat(64),
  selectorDigest: "f".repeat(64),
  stateId: "state-e657",
  stateDigest: "1".repeat(64),
  role: "admin",
  profile: "demo",
  routeKey: "admin:/admin",
  resolvedRoute: "/admin",
});

const pairDiagnosticFor = (
  branch: RevealBranch,
  knownBranches: readonly RevealBranch[],
  context: RevealReductionContext,
  currentControlCount: number,
  plannedControlCount: number,
) =>
  pairReductionDiagnosisFor({
    branch,
    knownBranches,
    context,
    expectedContext: { ...context },
    currentControlCount,
    plannedControlCount,
    maxControlsPerSegment: 8192,
  });

describe("pair-level reveal diagnosis", () => {
  it("reports exact savings without enabling reduction", () => {
    const fixture = fixtures();
    const branch = fixture.pairs[0];
    if (branch === undefined) throw new Error("Fixture pair is missing");
    const context = contextFor();
    const knownBranches = [...fixture.singles, ...fixture.pairs];
    const evidence = pairDiagnosticFor(
      branch,
      knownBranches,
      context,
      8139,
      60,
    );
    expect(evidence).toEqual({
      evidenceComplete: true,
      computedSavings: 2,
      requiredSavings: 7,
      thresholdSatisfied: false,
      reason: "threshold-not-met",
    });

    expect(
      pairDiagnosticFor(branch, knownBranches, context, 0, 0),
    ).toMatchObject({
      evidenceComplete: true,
      computedSavings: 2,
      requiredSavings: 0,
      thresholdSatisfied: true,
      reason: "diagnostic-complete",
    });
    expect(branch.path.steps).toHaveLength(2);
    expect(branch.surface.controls).toHaveLength(3);
    expect(independentDisclosureReductionFor({ branch, knownBranches })).toBe(
      false,
    );
  });

  it("fails closed for missing context and an untrusted fourth disclosure", () => {
    const fixture = fixtures();
    const branch = fixture.pairs[0];
    if (branch === undefined) throw new Error("Fixture pair is missing");
    const context = contextFor();
    const knownBranches = [...fixture.singles, ...fixture.pairs];
    expect(
      pairReductionDiagnosisFor({
        branch,
        knownBranches,
        context: undefined,
        expectedContext: { ...context },
        currentControlCount: 0,
        plannedControlCount: 0,
        maxControlsPerSegment: 8192,
      }),
    ).toMatchObject({
      evidenceComplete: false,
      reason: "context-not-bound",
    });
    const untrustedSteps = fixture.candidate.path.steps.map((step, index) =>
      index === 2
        ? {
            ...step,
            before: untrustedSurfaceFor(step.before),
            after: untrustedSurfaceFor(step.after),
          }
        : step,
    );
    const untrustedFourth: RevealBranch = {
      ...fixture.candidate,
      path: revealPathFor(untrustedSteps, "/admin"),
    };
    expect(
      pairDiagnosticFor(
        branch,
        [...knownBranches, untrustedFourth],
        context,
        0,
        0,
      ),
    ).toMatchObject({
      evidenceComplete: false,
      reason: "additional-disclosure",
    });
  });
});
