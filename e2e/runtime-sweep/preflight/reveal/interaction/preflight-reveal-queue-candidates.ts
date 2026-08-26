import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import { processCandidateIteration } from "./candidates/preflight-reveal-candidate-iteration.ts";
import {
  type RevealCandidateProcessingResult,
  type RevealContinuation,
  type RevealQueueYieldHandler,
} from "./candidates/preflight-reveal-queue-contracts.ts";
import type { VerifiedBranchRestorationLease } from "./evidence/preflight-reveal-operation-recorder.ts";
import {
  type RevealBranch,
  type RevealCandidate,
  revealCandidateAlreadyProcessed,
  type RevealDiscoveryState,
  type RevealPureQueueInput,
  type RevealQueueInput,
} from "./preflight-reveal-branches.ts";
import type { CandidateProcessor } from "./preflight-reveal-queue-failure-boundary.ts";
import {
  type CandidateLoopCursor,
  type RevealBranchReusePolicy,
} from "./restoration/preflight-reveal-branch-reuse-policy.ts";

export type {
  RevealCandidateProcessingResult,
  RevealContinuation,
  RevealQueueYieldHandler,
  RevealQueueYieldInput,
} from "./candidates/preflight-reveal-queue-contracts.ts";

export const candidatesAtBoundary = (
  input: RevealPureQueueInput,
  state: RevealDiscoveryState,
  branch: RevealBranch,
  queue: readonly RevealBranch[],
  canonicalCandidates?: readonly RevealCandidate[],
): RevealContinuation | undefined => {
  const candidates =
    canonicalCandidates ?? candidatesForImmediateReveal(input, branch);
  const boundary: RevealDiscoveryState = {
    ...state,
    queue,
    currentBranch: branch,
    currentCandidates: candidates,
    currentCandidateIndex: 0,
  };
  const nextCandidateIndex = candidates.findIndex(
    (candidate) =>
      !revealCandidateAlreadyProcessed(boundary, branch, candidate),
  );
  if (nextCandidateIndex === -1) return undefined;
  return {
    state: { ...boundary, currentCandidateIndex: nextCandidateIndex },
    currentBranch: branch,
    remainingQueue: queue,
    candidates,
    nextCandidateIndex,
  };
};

export const nextContinuationFor = (
  input: RevealPureQueueInput,
  state: RevealDiscoveryState,
): RevealContinuation | undefined => {
  for (const [index, first] of state.queue.entries()) {
    const continuation = candidatesAtBoundary(
      input,
      state,
      first,
      state.queue.slice(index + 1),
    );
    if (continuation !== undefined) return continuation;
  }
  return undefined;
};

interface MutableCandidateCursor {
  state: RevealDiscoveryState;
  restoredBranch: RevealBranch | undefined;
  restorationLease: VerifiedBranchRestorationLease | undefined;
  restorationScope: CandidateLoopCursor["restorationScope"];
}

const initialCandidateCursorFor = (input: {
  readonly state: RevealDiscoveryState;
  readonly restoredBranch?: RevealBranch;
  readonly restorationLease?: VerifiedBranchRestorationLease;
}): MutableCandidateCursor => ({
  state: input.state,
  restoredBranch: input.restoredBranch,
  restorationLease: input.restorationLease,
  restorationScope:
    input.restoredBranch === undefined && input.restorationLease === undefined
      ? undefined
      : "generic",
});

const immutableCandidateCursorFor = (
  cursor: MutableCandidateCursor,
): CandidateLoopCursor => ({
  state: cursor.state,
  ...(cursor.restoredBranch === undefined
    ? {}
    : { restoredBranch: cursor.restoredBranch }),
  ...(cursor.restorationLease === undefined
    ? {}
    : { restorationLease: cursor.restorationLease }),
  ...(cursor.restorationScope === undefined
    ? {}
    : { restorationScope: cursor.restorationScope }),
});

const branchReusePropertyFor = (
  branchReuse: RevealBranchReusePolicy | undefined,
): Readonly<{ branchReuse?: RevealBranchReusePolicy }> =>
  branchReuse === undefined ? {} : { branchReuse };

const yieldHandlerPropertyFor = (
  shouldYieldAfterCandidate: RevealQueueYieldHandler | undefined,
): Readonly<{ shouldYieldAfterCandidate?: RevealQueueYieldHandler }> =>
  shouldYieldAfterCandidate === undefined ? {} : { shouldYieldAfterCandidate };

export const processCandidates = async (
  input: {
    readonly queueInput: RevealQueueInput;
    readonly state: RevealDiscoveryState;
    readonly current: RevealBranch;
    readonly candidates: readonly RevealCandidate[];
    readonly index: number;
    readonly restoredBranch?: RevealBranch;
    readonly restorationLease?: VerifiedBranchRestorationLease;
    readonly branchReuse?: RevealBranchReusePolicy;
    readonly shouldYieldAfterCandidate?: RevealQueueYieldHandler;
  },
  processCandidate: CandidateProcessor,
): Promise<RevealCandidateProcessingResult> => {
  const {
    queueInput,
    current,
    candidates,
    index,
    restoredBranch,
    restorationLease,
    branchReuse,
    shouldYieldAfterCandidate,
  } = input;
  const cursor = initialCandidateCursorFor({
    state: input.state,
    ...(restoredBranch === undefined ? {} : { restoredBranch }),
    ...(restorationLease === undefined ? {} : { restorationLease }),
  });
  for (const [offset] of candidates.slice(index).entries()) {
    const candidateIndex = index + offset;
    const result = await processCandidateIteration({
      queueInput,
      cursor: immutableCandidateCursorFor(cursor),
      current,
      candidates,
      candidateIndex,
      nextContinuation: nextContinuationFor,
      ...branchReusePropertyFor(branchReuse),
      ...yieldHandlerPropertyFor(shouldYieldAfterCandidate),
      processCandidate,
    });
    cursor.state = result.cursor.state;
    cursor.restoredBranch = result.cursor.restoredBranch;
    cursor.restorationLease = result.cursor.restorationLease;
    cursor.restorationScope = result.cursor.restorationScope;
    if (result.yielded !== undefined)
      return { state: cursor.state, yielded: result.yielded };
  }
  const {
    currentBranch: _currentBranch,
    currentCandidates: _currentCandidates,
    currentCandidateIndex: _currentCandidateIndex,
    ...withoutCursor
  } = cursor.state;
  return { state: { ...withoutCursor, queue: cursor.state.queue } };
};
