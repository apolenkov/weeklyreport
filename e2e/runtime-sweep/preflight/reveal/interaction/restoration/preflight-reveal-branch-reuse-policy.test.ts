import { describe, expect, it, vi } from "vitest";

import { revealTransitionFor } from "../../../../matrix/reveal-transition.ts";
import { makePlan } from "../../../capacity/preflight-capacity-survey-test-support.ts";
import { revealPathFor, revealSurfaceFor } from "../../../reveal-path.ts";
import { createRevealOperationRecorder } from "../evidence/preflight-reveal-operation-recorder.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
  RevealDiscoveryState,
  RevealQueueInput,
} from "../preflight-reveal-branches.ts";
import { processCandidates } from "../preflight-reveal-queue-candidates.ts";
import type { CandidateProcessor } from "../preflight-reveal-queue-failure-boundary.ts";
import type { RevealBranchReusePolicy } from "./preflight-reveal-branch-reuse-policy.ts";

const proof = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};

const candidateFor = (name: string, order: number): RevealCandidate => {
  const controlKey = `button:${name}:1`;
  return {
    control: {
      controlKey,
      domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
      order,
      role: "button",
      accessibleName: name,
      enabled: true,
      disabled: false,
      visible: true,
      tagName: "button",
      inputType: null,
      href: null,
    },
    action: {
      controlKey,
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
  };
};

const first = candidateFor("First", 1);
const second = candidateFor("Second", 2);
const candidates = [first, second] as const;
const inventory = {
  controls: candidates.map(({ control }) => control),
  issues: [],
} as const;
const surface = revealSurfaceFor(inventory.controls);
const branch: RevealBranch = {
  path: revealPathFor([], "/admin?tab=actions"),
  inventory,
  surface,
  url: "/admin?tab=actions",
};

const restorationLeaseFor = () => {
  const recorder = createRevealOperationRecorder({
    childExecutionId: "f".repeat(64),
    childOrdinal: 0,
  });
  recorder.recordCandidate({ source: branch, candidate: first });
  return recorder.createRestorationLease({
    source: branch,
    terminal: branch,
    restored: branch,
    candidate: first,
    inverseAction: first.action,
    ariaControlsTarget: "fixture-target",
    nonMutation: proof,
  });
};

const initialState = (): RevealDiscoveryState => ({
  queue: [],
  controls: [],
  discovered: new Map(),
  visitedStatePaths: new Map(),
  actionCount: 0,
  branchCount: 0,
  currentBranch: branch,
  currentCandidates: candidates,
  currentCandidateIndex: 0,
});

const queueInput: RevealQueueInput = {
  state: makePlan().state,
  route: { resolvedRoute: "/admin" },
  initialSurface: surface,
  harness: {
    prepare: () => Promise.resolve(),
    navigate: () => Promise.resolve(),
    currentUrl: () => "http://127.0.0.1:3205/admin?tab=actions",
    inventory: () => Promise.resolve(inventory),
    executeReveal: () => Promise.reject(new Error("unused harness")),
  },
  controlFor: () => {
    throw new Error("unused control factory");
  },
  plansFor: () => [],
  candidatesFor: () => [],
  maxDepth: 4,
  maxRevealMaterialEdges: 32,
  maxRevealActions: 64,
  maxControlsPerSegment: 64,
};

const terminalFor = (
  candidate: RevealCandidate,
  candidateIndex: number,
): RevealCandidateTerminalResult => ({
  candidate,
  candidateIndex,
  materialChanged: false,
  result: {
    branch,
    explore: true,
    transition: revealTransitionFor(
      candidate.action,
      surface,
      surface,
      branch.url,
      branch.url,
      proof,
      null,
    ),
  },
});

const processorFor =
  (received: boolean[], processed: string[] = []): CandidateProcessor =>
  ({ state, candidate, restoredBranch, restorationLease }) => {
    received.push(
      restoredBranch === branch || restorationLease?.branch === branch,
    );
    processed.push(candidate.control.accessibleName);
    return Promise.resolve({
      state,
      executed: true,
      terminal: terminalFor(candidate, state.currentCandidateIndex ?? 0),
    });
  };

describe("branch reuse queue policy", () => {
  it("reuses only after a non-yielding terminal and preserves candidate order", async () => {
    const received: boolean[] = [];
    const processed: string[] = [];
    const restored = vi.fn<RevealBranchReusePolicy["restoreAfter"]>(() =>
      Promise.resolve(restorationLeaseFor()),
    );
    const policy: RevealBranchReusePolicy = {
      canReuseFor: () => true,
      restoreAfter: restored,
    };

    const result = await processCandidates(
      {
        queueInput,
        state: initialState(),
        current: branch,
        candidates,
        index: 0,
        branchReuse: policy,
        shouldYieldAfterCandidate: () => false,
      },
      processorFor(received, processed),
    );

    expect(result.yielded).toBeUndefined();
    expect(received).toEqual([false, true]);
    expect(processed).toEqual(["First", "Second"]);
    expect(restored).toHaveBeenCalledOnce();
    expect(restored.mock.calls[0]?.[0].terminal.candidate).toBe(first);
  });

  it("never restores or serializes reused state across a yield", async () => {
    const received: boolean[] = [];
    const restored = vi.fn<RevealBranchReusePolicy["restoreAfter"]>(() =>
      Promise.resolve(restorationLeaseFor()),
    );

    const result = await processCandidates(
      {
        queueInput,
        state: initialState(),
        current: branch,
        candidates,
        index: 0,
        branchReuse: {
          canReuseFor: () => true,
          restoreAfter: restored,
        },
        shouldYieldAfterCandidate: () => true,
      },
      processorFor(received),
    );

    expect(received).toEqual([false]);
    expect(restored).not.toHaveBeenCalled();
    expect(result.yielded).toMatchObject({
      completed: false,
      nextCandidateIndex: 1,
    });
    expect(result.yielded?.state).not.toHaveProperty("restoredBranch");
  });

  it("keeps the next ordinary candidate on full replay", async () => {
    const received: boolean[] = [];
    const restored = vi.fn<RevealBranchReusePolicy["restoreAfter"]>(() =>
      Promise.resolve(restorationLeaseFor()),
    );

    await processCandidates(
      {
        queueInput,
        state: initialState(),
        current: branch,
        candidates,
        index: 0,
        branchReuse: {
          canReuseFor: ({ candidate }) => candidate === first,
          restoreAfter: restored,
        },
      },
      processorFor(received),
    );

    expect(received).toEqual([false, false]);
    expect(restored).not.toHaveBeenCalled();
  });

  it.each([
    new Error("inverse restoration drifted"),
    new Error("inverse restoration timeout"),
    new DOMException("inverse restoration aborted", "AbortError"),
  ])(
    "publishes no continuation before the next candidate when restoration fails: %s",
    async (failure) => {
      const received: boolean[] = [];

      await expect(
        processCandidates(
          {
            queueInput,
            state: initialState(),
            current: branch,
            candidates,
            index: 0,
            branchReuse: {
              canReuseFor: () => true,
              restoreAfter: () => Promise.reject(failure),
            },
            shouldYieldAfterCandidate: () => false,
          },
          processorFor(received),
        ),
      ).rejects.toBe(failure);
      expect(received).toEqual([false]);
    },
  );
});
