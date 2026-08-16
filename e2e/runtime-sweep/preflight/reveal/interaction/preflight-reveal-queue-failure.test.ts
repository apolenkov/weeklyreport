import { describe, expect, it } from "vitest";

import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import { revealPathFor, revealSurfaceFor } from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealDiscoveryState,
  RevealQueueInput,
} from "./preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "./preflight-reveal-candidate-identity.ts";
import { processCandidates } from "./preflight-reveal-queue-candidates.ts";

const candidate: RevealCandidate = {
  control: {
    controlKey: "button:failure-frontier:0",
    domOrderKey: "0000:button:failure-frontier:0",
    order: 0,
    role: "button",
    accessibleName: "Failure frontier",
    enabled: true,
    disabled: false,
    visible: true,
    tagName: "button",
    inputType: null,
    href: null,
  },
  action: {
    controlKey: "button:failure-frontier:0",
    operation: "click",
    safety: "read-only",
    transition: "open",
  },
};

const branch = (): RevealBranch => {
  const inventory = { controls: [candidate.control], issues: [] } as const;
  return {
    inventory,
    path: revealPathFor([], "/reports/active"),
    surface: revealSurfaceFor(inventory.controls),
    url: "/reports/active",
    preparation: undefined,
  };
};

const stateFor = (current: RevealBranch): RevealDiscoveryState => ({
  queue: [],
  controls: [],
  discovered: new Map(),
  visitedStatePaths: new Map(),
  actionCount: 0,
  branchCount: 0,
  currentBranch: current,
  currentCandidates: [candidate],
  currentCandidateIndex: 0,
});

const queueInputFor = (
  onCandidateFailure: NonNullable<RevealQueueInput["onCandidateFailure"]>,
): RevealQueueInput => {
  const current = branch();
  return {
    state: makePlan().state,
    route: { resolvedRoute: "/reports/active" },
    initialSurface: current.surface,
    harness: {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => "http://127.0.0.1:3105/reports/active",
      inventory: () => Promise.resolve(current.inventory),
      executeReveal: () => Promise.reject(new Error("unused test harness")),
    },
    controlFor: () => {
      throw new Error("unused test control factory");
    },
    plansFor: () => [],
    candidatesFor: () => [],
    maxDepth: 1,
    maxRevealMaterialEdges: 1,
    maxRevealActions: 1,
    maxControlsPerSegment: 1,
    onCandidateFailure,
  };
};

describe("preflight reveal candidate failure boundary", () => {
  it("captures the exact pre-cursor frontier and rethrows the original error", async () => {
    const current = branch();
    const state = stateFor(current);
    const original = new Error("terminal candidate failed");
    const captured: unknown[] = [];

    const operation = processCandidates(
      {
        queueInput: queueInputFor((failure) => {
          captured.push(failure);
          return Promise.reject(new Error("capture publication failed"));
        }),
        state,
        current,
        candidates: [candidate],
        index: 0,
      },
      () => Promise.reject(original),
    );

    await expect(operation).rejects.toBe(original);
    expect(captured).toEqual([
      {
        state,
        branch: current,
        candidates: [candidate],
        candidateIndex: 0,
        candidateIdentity: revealCandidateIdentityFor({
          branch: current,
          candidate,
        }),
        originalError: original,
      },
    ]);
    expect(state.currentCandidateIndex).toBe(0);
  });

  it("preserves the original error when the failure handler throws synchronously", async () => {
    const current = branch();
    const state = stateFor(current);
    const original = new Error("terminal candidate failed");
    const captureError = new Error("synchronous capture failure");

    const operation = processCandidates(
      {
        queueInput: queueInputFor(() => {
          throw captureError;
        }),
        state,
        current,
        candidates: [candidate],
        index: 0,
      },
      () => Promise.reject(original),
    );

    await expect(operation).rejects.toBe(original);
    expect(state.currentCandidateIndex).toBe(0);
  });
});
