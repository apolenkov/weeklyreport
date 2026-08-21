import { describe, expect, it } from "vitest";

import { preflightControlForPlan } from "../../execution/playwright-preflight-support.ts";
import {
  controlFor,
  inventoryFor,
  selectionFor,
  withSource,
} from "../continuation/preflight-reveal-continuation-fixture.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
  type RevealRoute,
} from "./preflight-reveal-discovery.ts";

const ORIGIN = "http://127.0.0.1:3205";
const DATABASE_DIGEST = "d".repeat(64);

const harnessFor = (input: {
  readonly route: RevealRoute;
  readonly root: ReturnType<typeof inventoryFor>;
  readonly nested: ReturnType<typeof inventoryFor>;
  readonly deep: ReturnType<typeof inventoryFor>;
  readonly terminal: ReturnType<typeof inventoryFor>;
}): RevealExecutionHarness => {
  let currentUrl = `${ORIGIN}${input.route.resolvedRoute}`;
  let currentInventory = input.root;
  return {
    prepare: () => {
      currentUrl = `${ORIGIN}${input.route.resolvedRoute}`;
      currentInventory = input.root;
      return Promise.resolve();
    },
    navigate: (route) => {
      currentUrl = new URL(route, ORIGIN).href;
      return Promise.resolve();
    },
    currentUrl: () => currentUrl,
    inventory: () => Promise.resolve(currentInventory),
    executeReveal: ({ action }) => {
      if (action.controlKey === "button:a-open:0") {
        currentInventory = input.nested;
        currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=open`;
      } else if (action.controlKey === "button:n-first:0") {
        currentInventory = input.deep;
        currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=deep`;
      } else if (action.controlKey === "button:d-first:0") {
        currentInventory = input.terminal;
        currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=terminal`;
      } else {
        currentInventory = inventoryFor([]);
        currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=empty`;
      }
      return Promise.resolve({
        url: currentUrl,
        inventory: currentInventory,
        nonMutation: {
          status: "unchanged",
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
};

describe("step eligibility in shared reveal control capacity", () => {
  it("identifies the first ineligible step at a depth-three capacity boundary", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
      ]);
      const nested = inventoryFor([
        controlFor("button:n-first:0", "Nested action", 0),
      ]);
      const deep = inventoryFor([
        controlFor("button:d-first:0", "Deep action", 0),
      ]);
      const terminal = inventoryFor([
        controlFor("button:t-first:0", "Terminal action", 0),
      ]);

      await expect(
        discoverRevealControls({
          state,
          route,
          initialInventory: root,
          harness: harnessFor({ route, root, nested, deep, terminal }),
          controlFor: preflightControlForPlan,
          maxControlsPerSegment: 3,
        }),
      ).rejects.toThrow(
        "Reveal control bound exceeded: 4 controls; maxControlsPerSegment is 3; reductionReason=step-not-eligible; reductionStepIndex=0; reductionPredicate=url-changed; pathDepth=3; knownBranches=3; plannedControls=1; projectedControls=4",
      );
    });
  });
});
