import { describe, expect, it } from "vitest";

import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { planLiveControlActions } from "../../../replay/live-control/live-control-planning.ts";
import type { Action } from "../../../source/contracts.ts";
import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight-support.ts";
import {
  revealPathFor,
  revealStepFor,
  type RevealSurface,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
  RevealPureQueueInput,
} from "./preflight-reveal-branches.ts";
import { enqueueChangedBranch } from "./preflight-reveal-branches.ts";
import {
  controlKeyForTarget,
  retainedStateFor,
  trustedKnownBranchesFor,
  trustedSurfaceFor,
  type TrustedToggle,
} from "./preflight-reveal-canonicalization-enqueue-fixture.ts";

const TOGGLES = ["a", "b", "c", "d"] as const;
type Toggle = (typeof TOGGLES)[number];
type IndependentToggle = "a" | "b" | "c";

const unchanged = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};

const controlFor = (
  key: Toggle,
  expanded: boolean,
  cExpanded: boolean,
): DomControlObservation => ({
  controlKey: `button:${key}:0`,
  domOrderKey: `000${String(TOGGLES.indexOf(key) + 1)}:button:${key}:0`,
  order: TOGGLES.indexOf(key) + 1,
  role: "button",
  accessibleName:
    key === "d" && cExpanded ? "Toggle d affected" : `Toggle ${key}`,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls: `panel-${key}`,
  ariaExpanded: expanded,
  ...(key === "d" ? {} : { disclosureIndependence: "source-bound-row-local" }),
});

const inventoryFor = (expanded: ReadonlySet<Toggle>): DomInventory => ({
  controls: TOGGLES.map((key) =>
    controlFor(key, expanded.has(key), expanded.has("c")),
  ),
  issues: [],
});

const surfaceFor = (expanded: ReadonlySet<Toggle>): RevealSurface =>
  revealSurfaceFor(inventoryFor(expanded).controls);

const actionFor = (key: Toggle): Action => ({
  controlKey: `button:${key}:0`,
  operation: "click",
  safety: "read-only",
  transition: "open",
});

const branchFor = (
  keys: readonly Toggle[],
  states: readonly ReadonlySet<Toggle>[],
): RevealBranch => {
  const surfaces = states.map(surfaceFor);
  const inventories = states.map(inventoryFor);
  const steps = keys.map((key, index) => {
    const before = surfaces[index];
    const after = surfaces[index + 1];
    if (before === undefined || after === undefined)
      throw new Error("Fixture surface is missing");
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
  const finalInventory = inventories.at(-1);
  if (finalSurface === undefined || finalInventory === undefined)
    throw new Error("Fixture final state is missing");
  return {
    path: revealPathFor(steps, "/admin"),
    inventory: finalInventory,
    surface: finalSurface,
    url: "/admin",
  };
};

const stateSets = {
  root: new Set<Toggle>(),
  a: new Set<Toggle>(["a"]),
  b: new Set<Toggle>(["b"]),
  c: new Set<Toggle>(["c"]),
  ab: new Set<Toggle>(["a", "b"]),
  ac: new Set<Toggle>(["a", "c"]),
  ba: new Set<Toggle>(["b", "a"]),
  bc: new Set<Toggle>(["b", "c"]),
  ca: new Set<Toggle>(["c", "a"]),
  cb: new Set<Toggle>(["c", "b"]),
  abc: new Set<Toggle>(["a", "b", "c"]),
} as const;

const knownBranchesFor = (): Readonly<{
  readonly current: RevealBranch;
  readonly candidate: RevealBranch;
  readonly known: readonly RevealBranch[];
}> => {
  const root = stateSets.root;
  const single = (key: IndependentToggle, state: ReadonlySet<Toggle>) =>
    branchFor([key], [root, state]);
  const pair = (
    first: IndependentToggle,
    second: IndependentToggle,
    firstState: ReadonlySet<Toggle>,
    finalState: ReadonlySet<Toggle>,
  ) => branchFor([first, second], [root, firstState, finalState]);
  const current = pair("a", "b", stateSets.a, stateSets.ab);
  const candidate = branchFor(
    ["a", "b", "c"],
    [root, stateSets.a, stateSets.ab, stateSets.abc],
  );
  return {
    current,
    candidate,
    known: [
      single("a", stateSets.a),
      single("b", stateSets.b),
      single("c", stateSets.c),
      pair("a", "b", stateSets.a, stateSets.ab),
      pair("b", "a", stateSets.b, stateSets.ba),
      pair("a", "c", stateSets.a, stateSets.ac),
      pair("c", "a", stateSets.c, stateSets.ca),
      pair("b", "c", stateSets.b, stateSets.bc),
      pair("c", "b", stateSets.c, stateSets.cb),
    ],
  };
};

const discoveryStateFor = (
  current: RevealBranch,
  known: readonly RevealBranch[],
): RevealDiscoveryState => ({
  queue: known,
  controls: [],
  discovered: new Map(),
  visitedStatePaths: new Map(),
  actionCount: 0,
  branchCount: 0,
  currentBranch: current,
});

const queueInputFor = (
  maxControlsPerSegment: number,
  root: RevealSurface,
): RevealPureQueueInput => ({
  state: makePlan().state,
  route: { resolvedRoute: "/admin" },
  initialSurface: root,
  controlFor: preflightControlForPlan,
  plansFor: (inventory) => planLiveControlActions(inventory.controls),
  candidatesFor: () => [],
  maxDepth: 4,
  maxRevealMaterialEdges: 128,
  maxRevealActions: 256,
  maxControlsPerSegment,
});

describe("source-bound canonicalization enqueue boundary", () => {
  it("retains every saved row-local control while skipping the deeper branch", () => {
    const fixture = trustedKnownBranchesFor();
    expect(controlKeyForTarget(fixture.representative, "panel-c")).toBe(
      "button:c:2",
    );
    expect(controlKeyForTarget(fixture.candidate, "panel-c")).toBe(
      "button:c:1",
    );
    const queueInput = queueInputFor(
      2,
      trustedSurfaceFor(new Set<TrustedToggle>()),
    );
    const state = retainedStateFor(fixture, queueInput);
    expect(
      state.controls.map(({ inventory }) => inventory.ariaControls),
    ).toEqual(["panel-c", "panel-d"]);
    expect(
      new Set(
        state.controls.map(({ expectedSurface }) => expectedSurface.digest),
      ).size,
    ).toBe(1);
    const next = enqueueChangedBranch({
      queueInput,
      state,
      current: fixture.current,
      branch: fixture.candidate,
      action: actionFor("c"),
    });

    expect(next.queue).not.toContain(fixture.candidate);
    expect(next.controls).toEqual(state.controls);
    expect(next.visitedStatePaths.size).toBe(state.visitedStatePaths.size + 1);
  });

  it("keeps a duplicate target representative on the ordinary path", () => {
    const fixture = trustedKnownBranchesFor();
    const retained = retainedStateFor(
      fixture,
      queueInputFor(2, trustedSurfaceFor(new Set<TrustedToggle>())),
    );
    const target = retained.controls.find(
      ({ inventory }) => inventory.ariaControls === "panel-c",
    );
    if (target === undefined) throw new Error("Missing panel-c representative");
    const next = enqueueChangedBranch({
      queueInput: queueInputFor(5, trustedSurfaceFor(new Set<TrustedToggle>())),
      state: { ...retained, controls: [...retained.controls, target] },
      current: fixture.current,
      branch: fixture.candidate,
      action: actionFor("c"),
    });

    expect(next.queue).toContain(fixture.candidate);
    expect(
      next.controls.filter(
        ({ inventory }) => inventory.ariaControls === "panel-c",
      ),
    ).toHaveLength(3);
  });

  it("falls back to ordinary registration when a reduced control is not retained", () => {
    const fixture = trustedKnownBranchesFor();
    const retained = retainedStateFor(
      fixture,
      queueInputFor(2, trustedSurfaceFor(new Set<TrustedToggle>())),
    );
    const next = enqueueChangedBranch({
      queueInput: queueInputFor(2, trustedSurfaceFor(new Set<TrustedToggle>())),
      state: { ...retained, controls: [], discovered: new Map() },
      current: fixture.current,
      branch: fixture.candidate,
      action: actionFor("c"),
    });

    expect(next.queue).toContain(fixture.candidate);
    expect(
      next.controls.map(({ inventory }) => inventory.ariaControls),
    ).toEqual(["panel-c", "panel-d"]);
    expect(next.discovered.size).toBe(2);
  });

  it("keeps the plus-one guard fail-closed when retention is missing", () => {
    const fixture = trustedKnownBranchesFor();
    const retained = retainedStateFor(
      fixture,
      queueInputFor(2, trustedSurfaceFor(new Set<TrustedToggle>())),
    );

    expect(() =>
      enqueueChangedBranch({
        queueInput: queueInputFor(
          3,
          trustedSurfaceFor(new Set<TrustedToggle>()),
        ),
        state: { ...retained, discovered: new Map() },
        current: fixture.current,
        branch: fixture.candidate,
        action: actionFor("c"),
      }),
    ).toThrow(/reductionReason=reduction-proven.*projectedControls=4/iu);
  });

  it("retains the ordinary branch and the untrusted fourth control", () => {
    const fixture = knownBranchesFor();
    const next = enqueueChangedBranch({
      queueInput: queueInputFor(2, surfaceFor(stateSets.root)),
      state: discoveryStateFor(fixture.current, fixture.known),
      current: fixture.current,
      branch: fixture.candidate,
      action: actionFor("c"),
    });

    expect(next.queue).toContain(fixture.candidate);
    expect(next.controls.map(({ controlKey }) => controlKey)).toEqual([
      "button:c:0",
      "button:d:0",
    ]);
  });

  it("keeps the plus-one capacity guard fail-closed for that branch", () => {
    const fixture = knownBranchesFor();

    expect(() =>
      enqueueChangedBranch({
        queueInput: queueInputFor(1, surfaceFor(stateSets.root)),
        state: discoveryStateFor(fixture.current, fixture.known),
        current: fixture.current,
        branch: fixture.candidate,
        action: actionFor("c"),
      }),
    ).toThrow(/reductionReason=untrusted-disclosure.*projectedControls=2/iu);
  });
});
