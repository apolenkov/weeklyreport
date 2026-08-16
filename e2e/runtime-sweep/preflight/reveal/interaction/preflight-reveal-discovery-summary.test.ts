import { describe, expect, it } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import { revealSurfaceFor } from "../../reveal-path.ts";
import {
  discoverRevealControls,
  discoverRevealControlsWithSummary,
  type RevealExecutionHarness,
} from "./preflight-reveal-discovery.ts";

const ORIGIN = "http://127.0.0.1:3205";
const ROUTE = "/admin";
const DATABASE_DIGEST = "d".repeat(64);

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "discovery-summary-state",
  pairwiseDigest: "a".repeat(64),
  axes: {
    role: "admin",
    route: `admin:${ROUTE}`,
    profileCapability: "admin-examples",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};

type NodeName = "root" | "child" | "grandchild";

type GraphNode = Readonly<{
  readonly inventory: DomInventory;
  readonly url: string;
  readonly nextByControl: Readonly<Record<string, NodeName>>;
}>;

const control = (
  controlKey: string,
  accessibleName: string,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `0001:${controlKey}`,
  order: 1,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

const inventory = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

const OPEN_CHILD = control("button:Open%20child:1", "Open child");
const OPEN_GRANDCHILD = control(
  "button:Open%20grandchild:1",
  "Open grandchild",
);

const graph: Readonly<Record<NodeName, GraphNode>> = {
  root: {
    inventory: inventory([OPEN_CHILD]),
    url: ROUTE,
    nextByControl: { [OPEN_CHILD.controlKey]: "child" },
  },
  child: {
    inventory: inventory([OPEN_GRANDCHILD]),
    url: `${ROUTE}?step=child`,
    nextByControl: { [OPEN_GRANDCHILD.controlKey]: "grandchild" },
  },
  grandchild: {
    inventory: inventory([]),
    url: `${ROUTE}?step=grandchild`,
    nextByControl: {},
  },
};

const browserUrlFor = (path: string): string => new URL(path, ORIGIN).href;

const fixtureFor = (): Readonly<{
  readonly harness: RevealExecutionHarness;
  readonly executionCount: () => number;
}> => {
  let current: NodeName = "root";
  let executions = 0;
  const harness: RevealExecutionHarness = {
    prepare: () => {
      current = "root";
      return Promise.resolve();
    },
    navigate: () => {
      current = "root";
      return Promise.resolve();
    },
    currentUrl: () => browserUrlFor(graph[current].url),
    inventory: () => Promise.resolve(graph[current].inventory),
    executeReveal: ({ action }) => {
      const next = graph[current].nextByControl[action.controlKey];
      if (next === undefined)
        return Promise.reject(
          new Error(`Unknown planted edge: ${current}/${action.controlKey}`),
        );
      executions += 1;
      current = next;
      return Promise.resolve({
        url: browserUrlFor(graph[current].url),
        inventory: graph[current].inventory,
        nonMutation: {
          status: "unchanged" as const,
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return { harness, executionCount: () => executions };
};

const discoveryInputFor = (
  harness: RevealExecutionHarness,
  overrides: Readonly<{
    readonly maxRevealMaterialEdges?: number;
  }> = {},
) => ({
  state,
  route: { resolvedRoute: ROUTE },
  initialInventory: graph.root.inventory,
  harness,
  controlFor: preflightControlForPlan,
  maxDepth: 4,
  maxRevealActions: 16,
  maxControlsPerSegment: 8,
  ...overrides,
});

describe("preflight reveal discovery summary", () => {
  it("reports terminal counts from the same planted queue traversal", async () => {
    const fixture = fixtureFor();
    const progress: unknown[] = [];

    const result = await discoverRevealControlsWithSummary({
      ...discoveryInputFor(fixture.harness),
      onProgress: (sample) => progress.push(sample),
    });

    expect(result.summary).toEqual({
      completedCandidateCount: 2,
      revealActionCount: 3,
      materialEdgeCount: 2,
      controlCount: 2,
      visitedStateCount: 3,
      maxQueueLength: 1,
      initialSurfaceDigest: revealSurfaceFor(graph.root.inventory.controls)
        .digest,
      queueEmpty: true,
    });
    expect(result.controls).toHaveLength(2);
    expect(fixture.executionCount()).toBe(3);
    expect(progress).toEqual([
      {
        completedCandidateCount: 1,
        revealActionCount: 1,
        materialEdgeCount: 1,
        controlCount: 2,
        visitedStateCount: 2,
        queueLength: 1,
        maxQueueLength: 1,
      },
      {
        completedCandidateCount: 2,
        revealActionCount: 3,
        materialEdgeCount: 2,
        controlCount: 2,
        visitedStateCount: 3,
        queueLength: 1,
        maxQueueLength: 1,
      },
    ]);
  });

  it("does not return a partial summary when a material edge bound overflows", async () => {
    const fixture = fixtureFor();

    await expect(
      discoverRevealControlsWithSummary(
        discoveryInputFor(fixture.harness, { maxRevealMaterialEdges: 1 }),
      ),
    ).rejects.toThrow(/material edge bound exceeded/iu);
  });

  it("keeps the ordinary controls wrapper equivalent without duplicate execution", async () => {
    const summaryFixture = fixtureFor();
    const wrapperFixture = fixtureFor();

    const summarized = await discoverRevealControlsWithSummary(
      discoveryInputFor(summaryFixture.harness),
    );
    const controls = await discoverRevealControls(
      discoveryInputFor(wrapperFixture.harness),
    );

    expect(controls).toEqual(summarized.controls);
    expect(summaryFixture.executionCount()).toBe(3);
    expect(wrapperFixture.executionCount()).toBe(3);
  });
});
