import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../replay/dom-inventory.ts";
import { preflightControlForPlan } from "./playwright-preflight.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "./preflight-reveal-discovery.ts";
import { revealSurfaceFor } from "./reveal-path.ts";

const ORIGIN = "http://127.0.0.1:3205";
const ROUTE = "/admin";
const DATABASE_DIGEST = "d".repeat(64);
const NODE_NAMES = Array.from(
  { length: 10 },
  (_, index) => `tab-${String(index).padStart(2, "0")}`,
);

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "semantic-graph-state",
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

type GraphNode = Readonly<{
  readonly name: string;
  readonly url: string;
  readonly inventory: DomInventory;
}>;

const absoluteUrlFor = (path: string): string => new URL(path, ORIGIN).href;

const observationFor = (
  targetName: string,
  order: number,
): DomControlObservation => ({
  controlKey: `tab:${targetName}:0`,
  domOrderKey: `${String(order).padStart(4, "0")}:tab:${targetName}:0`,
  order,
  role: "tab",
  accessibleName: `Tab ${targetName}`,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

const inventoryFor = (sourceName: string): DomInventory => ({
  controls: NODE_NAMES.filter((targetName) => targetName !== sourceName).map(
    (targetName, order) => observationFor(targetName, order),
  ),
  issues: [],
});

const graphNodes = NODE_NAMES.map<GraphNode>((name) => ({
  name,
  url: `${ROUTE}?tab=${name}`,
  inventory: inventoryFor(name),
}));
const surfaceDigestFor = (node: GraphNode): string =>
  revealSurfaceFor(node.inventory.controls).digest;

const root = graphNodes[0];
if (root === undefined) throw new Error("Missing semantic graph root");

const targetForControl = (controlKey: string): GraphNode | undefined => {
  const targetName = controlKey.split(":")[1];
  return graphNodes.find(({ name }) => name === targetName);
};

const currentNodeFor = (events: readonly string[]): GraphNode => {
  const lastPrepare = events.lastIndexOf("prepare");
  const executed = events
    .slice(lastPrepare + 1)
    .toReversed()
    .find((event) => event.startsWith("execute:"));
  if (executed === undefined) return root;
  const targetName = executed.split("->")[1];
  return graphNodes.find(({ name }) => name === targetName) ?? root;
};

const graphHarnessFor = (): Readonly<{
  readonly events: () => readonly string[];
  readonly harness: RevealExecutionHarness;
}> => {
  const recordEvent = vi.fn<(event: string) => void>();
  const events = (): readonly string[] =>
    recordEvent.mock.calls.map(([event]) => event);
  const harness: RevealExecutionHarness = {
    prepare: () => {
      recordEvent("prepare");
      return Promise.resolve();
    },
    navigate: () => {
      recordEvent("navigate");
      return Promise.resolve();
    },
    currentUrl: () => absoluteUrlFor(currentNodeFor(events()).url),
    inventory: () => Promise.resolve(currentNodeFor(events()).inventory),
    executeReveal: ({ action }) => {
      const source = currentNodeFor(events());
      const target = targetForControl(action.controlKey);
      if (target === undefined || target.name === source.name)
        return Promise.reject(
          new Error(`Invalid semantic graph edge: ${action.controlKey}`),
        );
      recordEvent(`execute:${source.name}->${target.name}`);
      return Promise.resolve({
        url: absoluteUrlFor(target.url),
        inventory: target.inventory,
        nonMutation: {
          status: "unchanged" as const,
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return { events, harness };
};

describe("semantic reveal graph traversal", () => {
  it("bounds a complete cyclic tab graph by semantic states and preserves edges", async () => {
    const fixture = graphHarnessFor();
    const controls = await discoverRevealControls({
      state,
      route: { resolvedRoute: ROUTE },
      initialInventory: root.inventory,
      harness: fixture.harness,
      controlFor: preflightControlForPlan,
      maxDepth: 3,
      maxBranches: 256,
      maxActions: 4096,
    });
    const executions = fixture
      .events()
      .filter((event) => event.startsWith("execute:"));
    expect(executions.length).toBeLessThan(256);
    const directEdges = new Set(
      controls
        .filter(({ expectedActionTransition }) =>
          Boolean(expectedActionTransition),
        )
        .map(({ controlKey, expectedActionTransition, expectedSurface }) =>
          [
            expectedSurface.digest,
            controlKey,
            expectedActionTransition?.afterUrl,
            expectedActionTransition?.afterSurfaceDigest,
          ].join(":"),
        ),
    );
    expect(directEdges.size).toBe(NODE_NAMES.length * (NODE_NAMES.length - 1));
    expect(
      new Set(controls.map(({ expectedSurface }) => expectedSurface.digest))
        .size,
    ).toBe(NODE_NAMES.length);
    graphNodes.forEach((source) => {
      const sourceControls = controls.filter(
        ({ expectedSurface }) =>
          expectedSurface.digest === surfaceDigestFor(source),
      );
      graphNodes
        .filter((target) => target.name !== source.name)
        .forEach((target) => {
          const control = sourceControls.find(
            ({ controlKey, expectedActionTransition }) =>
              controlKey === `tab:${target.name}:0` &&
              expectedActionTransition?.afterUrl === target.url,
          );
          expect(control).toBeDefined();
          expect(control?.expectedActionSurface?.digest).toBe(
            surfaceDigestFor(target),
          );
        });
    });
  });
});
