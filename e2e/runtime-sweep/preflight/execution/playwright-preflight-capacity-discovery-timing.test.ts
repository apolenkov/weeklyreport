import { describe, expect, it } from "vitest";

import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../replay/dom/dom-inventory.ts";
import { createCapacitySurveyTiming } from "../capacity/preflight-capacity-survey-timing.ts";
import { discoverRevealControlsWithSummary } from "../reveal/interaction/preflight-reveal-discovery.ts";
import type { RevealExecutionTimingStage } from "../reveal/interaction/preflight-reveal-types.ts";
import {
  type BrowserPreflightHarness,
  preflightControlForPlan,
  revealHarnessFor,
} from "./playwright-preflight.ts";
import { timedHarnessFor } from "./playwright-preflight-capacity-survey.ts";

const ORIGIN = "http://127.0.0.1:3205";
const ROUTE = "/admin";
const DATABASE_DIGEST = "d".repeat(64);

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "capacity-timing-discovery-state",
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

const controlFor = (
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

const OPEN_CHILD = controlFor("button:Open%20child:1", "Open child");
const OPEN_GRANDCHILD = controlFor(
  "button:Open%20grandchild:1",
  "Open grandchild",
);

const graph: Readonly<
  Record<
    NodeName,
    Readonly<{
      readonly inventory: DomInventory;
      readonly url: string;
      readonly nextByControl: Readonly<Record<string, NodeName>>;
    }>
  >
> = {
  root: {
    inventory: { controls: [OPEN_CHILD], issues: [] },
    url: ROUTE,
    nextByControl: { [OPEN_CHILD.controlKey]: "child" },
  },
  child: {
    inventory: { controls: [OPEN_GRANDCHILD], issues: [] },
    url: `${ROUTE}?step=child`,
    nextByControl: { [OPEN_GRANDCHILD.controlKey]: "grandchild" },
  },
  grandchild: {
    inventory: { controls: [], issues: [] },
    url: `${ROUTE}?step=grandchild`,
    nextByControl: {},
  },
};

const runDiscovery = async (enabled: boolean) => {
  let current: NodeName = "root";
  let nowMs = 0;
  const advance = (durationMs: number): void => {
    nowMs += durationMs;
  };
  const timing = createCapacitySurveyTiming({
    enabled,
    now: () => nowMs,
  });
  const harness: BrowserPreflightHarness & {
    readonly navigateReveal: BrowserPreflightHarness["navigate"];
  } = {
    expectedOrigin: ORIGIN,
    prepare: () => {
      current = "root";
      return Promise.resolve(undefined);
    },
    navigate: () => Promise.resolve(),
    navigateReveal: () => {
      current = "root";
      return Promise.resolve();
    },
    currentUrl: () => new URL(graph[current].url, ORIGIN).href,
    inventory: () => Promise.resolve(graph[current].inventory),
    executeReveal: async (input) => {
      const phase = async <Value>(
        stage: RevealExecutionTimingStage,
        durationMs: number,
        operation: () => Value | Promise<Value>,
      ): Promise<Value> => {
        const run = async (): Promise<Value> => {
          advance(durationMs);
          return operation();
        };
        return input.timing?.span(stage, run) ?? run();
      };
      await phase("representativeInput", 1, () => undefined);
      await phase("preSettle", 2, () => undefined);
      await phase("beforeSnapshot", 3, () => undefined);
      await phase("action", 4, async () => {
        const next = graph[current].nextByControl[input.action.controlKey];
        if (next === undefined)
          throw new Error(
            `Unknown planted edge: ${current}/${input.action.controlKey}`,
          );
        current = next;
        await phase("actionRevealReady", 1, () => undefined);
        await phase("actionNavigationBoundary", 1, () => undefined);
        await phase(
          input.action.controlKey === OPEN_CHILD.controlKey
            ? "navigationNone"
            : "navigationObserved",
          0,
          () => undefined,
        );
      });
      await phase("postSettle", 5, () => undefined);
      await phase("afterSnapshot", 6, () => undefined);
      const inventory = await phase("postObservation", 7, () =>
        Promise.resolve(graph[current].inventory),
      );
      return {
        url: new URL(graph[current].url, ORIGIN).href,
        inventory,
        nonMutation: {
          status: "unchanged" as const,
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      };
    },
  };
  const timedHarness = timedHarnessFor(harness, timing);
  timing.beginCandidateQueue();
  const result = await discoverRevealControlsWithSummary({
    state,
    route: { resolvedRoute: ROUTE },
    initialInventory: graph.root.inventory,
    harness: revealHarnessFor(timedHarness),
    controlFor: preflightControlForPlan,
    maxDepth: 4,
    maxRevealActions: 16,
    maxControlsPerSegment: 8,
  });
  timing.endCandidateQueue();
  return { result, timing: timing.snapshot() };
};

describe("capacity timing through reveal discovery", () => {
  it("preserves terminal output and reconciles production-attributed spans", async () => {
    const disabled = await runDiscovery(false);
    const enabled = await runDiscovery(true);
    const snapshot = enabled.timing;

    expect(enabled.result).toEqual(disabled.result);
    expect(snapshot.candidateExecuteCount).toBe(
      enabled.result.summary.completedCandidateCount,
    );
    expect(snapshot.replayExecuteCount + snapshot.candidateExecuteCount).toBe(
      enabled.result.summary.revealActionCount,
    );
    expect(snapshot.executeRevealWallMs).toBe(
      snapshot.candidateExecuteWallMs + snapshot.replayExecuteWallMs,
    );
    expect(snapshot.executeRevealWallMs).toBe(
      snapshot.preSettleWallMs +
        snapshot.beforeSnapshotWallMs +
        snapshot.actionWallMs +
        snapshot.postSettleWallMs +
        snapshot.afterSnapshotWallMs +
        snapshot.representativeInputWallMs +
        snapshot.postObservationWallMs,
    );
    expect(snapshot.actionRevealReadyCount).toBe(
      snapshot.actionNavigationBoundaryCount,
    );
    expect(snapshot.actionRevealReadyCount).toBe(
      snapshot.navigationNoneCount + snapshot.navigationObservedCount,
    );
    expect(snapshot.actionRevealReadyWallMs).toBeLessThanOrEqual(
      snapshot.actionWallMs,
    );
    expect(snapshot.actionNavigationBoundaryWallMs).toBeLessThanOrEqual(
      snapshot.actionWallMs,
    );
  });
});
