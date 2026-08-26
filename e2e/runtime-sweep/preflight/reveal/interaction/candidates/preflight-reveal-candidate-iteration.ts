import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
  RevealDiscoveryState,
  RevealPureQueueInput,
  RevealQueueChunkResult,
  RevealQueueInput,
} from "../preflight-reveal-branches.ts";
import {
  type CandidateProcessor,
  processCandidateAtFailureBoundary,
} from "../preflight-reveal-queue-failure-boundary.ts";
import { yieldAfterTerminal } from "../preflight-reveal-queue-yield.ts";
import { RevealDiscoveryError } from "../preflight-reveal-types.ts";
import {
  type CandidateIterationResult,
  type CandidateLoopCursor,
  restorationLeaseAfterTerminal,
  restorationLeaseForCandidate,
  type RevealBranchReusePolicy,
} from "../restoration/preflight-reveal-branch-reuse-policy.ts";
import type {
  RevealContinuation,
  RevealQueueYieldHandler,
} from "./preflight-reveal-queue-contracts.ts";

type NextContinuation = (
  input: RevealPureQueueInput,
  state: RevealDiscoveryState,
) => RevealContinuation | undefined;

const requiredCandidateAt = (
  candidates: readonly RevealCandidate[],
  index: number,
): RevealCandidate => {
  const candidate = candidates[index];
  if (candidate !== undefined) return candidate;
  throw new RevealDiscoveryError(
    `Reveal candidate ${String(index)} is missing from its ordered list`,
  );
};

const candidateCursorState = (
  state: RevealDiscoveryState,
  current: RevealBranch,
  candidates: readonly RevealCandidate[],
  nextCandidateIndex: number,
): RevealDiscoveryState => ({
  ...state,
  currentBranch: current,
  currentCandidates: candidates,
  currentCandidateIndex: nextCandidateIndex,
});

const terminalContinuationFor = (input: {
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly nextContinuation: NextContinuation;
}): RevealContinuation | undefined =>
  input.nextCandidateIndex < input.candidates.length
    ? undefined
    : input.nextContinuation(input.queueInput, input.state);

const processExecutedCandidate = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly terminal: RevealCandidateTerminalResult;
  readonly nextContinuation: NextContinuation;
  readonly shouldYieldAfterCandidate?: RevealQueueYieldHandler;
}): Promise<RevealQueueChunkResult | undefined> => {
  const continuation = terminalContinuationFor(input);
  return yieldAfterTerminal({
    state: input.state,
    current: input.current,
    candidates: input.candidates,
    nextCandidateIndex: input.nextCandidateIndex,
    terminal: input.terminal,
    ...(input.shouldYieldAfterCandidate === undefined
      ? {}
      : { shouldYieldAfterCandidate: input.shouldYieldAfterCandidate }),
    ...(continuation === undefined ? {} : { continuation }),
  });
};

const afterExecutedCandidate = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly terminal: RevealCandidateTerminalResult;
  readonly nextContinuation: NextContinuation;
  readonly branchReuse?: RevealBranchReusePolicy;
  readonly shouldYieldAfterCandidate?: RevealQueueYieldHandler;
}): Promise<CandidateIterationResult> => {
  const yielded = await processExecutedCandidate(input);
  if (yielded !== undefined) return { cursor: { state: input.state }, yielded };
  const restorationLease = await restorationLeaseAfterTerminal({
    ...(input.branchReuse === undefined ? {} : { policy: input.branchReuse }),
    state: input.state,
    current: input.current,
    candidates: input.candidates,
    nextCandidateIndex: input.nextCandidateIndex,
    terminal: input.terminal,
  });
  return {
    cursor: {
      state: input.state,
      ...(restorationLease === undefined
        ? {}
        : { restorationLease, restorationScope: "branch-local" as const }),
    },
  };
};

const retainedCursorFor = (
  state: RevealDiscoveryState,
  cursor: CandidateLoopCursor,
  restoredBranch: RevealBranch | undefined,
  restorationLease: CandidateLoopCursor["restorationLease"],
): CandidateIterationResult => ({
  cursor: {
    state,
    ...(restoredBranch === undefined ? {} : { restoredBranch }),
    ...(restorationLease === undefined
      ? {}
      : {
          restorationLease,
          ...(cursor.restorationScope === undefined
            ? {}
            : { restorationScope: cursor.restorationScope }),
        }),
  },
});

export const processCandidateIteration = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly cursor: CandidateLoopCursor;
  readonly current: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly candidateIndex: number;
  readonly nextContinuation: NextContinuation;
  readonly branchReuse?: RevealBranchReusePolicy;
  readonly shouldYieldAfterCandidate?: RevealQueueYieldHandler;
  readonly processCandidate: CandidateProcessor;
}): Promise<CandidateIterationResult> => {
  const candidate = requiredCandidateAt(input.candidates, input.candidateIndex);
  const restorationLease = restorationLeaseForCandidate({
    ...(input.branchReuse === undefined ? {} : { policy: input.branchReuse }),
    current: input.current,
    candidate,
    ...(input.cursor.restorationLease === undefined
      ? {}
      : { restorationLease: input.cursor.restorationLease }),
    ...(input.cursor.restorationScope === undefined
      ? {}
      : { restorationScope: input.cursor.restorationScope }),
  });
  const restoredBranch =
    restorationLease === undefined ? input.cursor.restoredBranch : undefined;
  const result = await processCandidateAtFailureBoundary({
    queueInput: input.queueInput,
    current: input.current,
    state: input.cursor.state,
    candidates: input.candidates,
    candidateIndex: input.candidateIndex,
    candidate,
    ...(restoredBranch === undefined ? {} : { restoredBranch }),
    ...(restorationLease === undefined ? {} : { restorationLease }),
    processCandidate: input.processCandidate,
  });
  const state = candidateCursorState(
    result.state,
    input.current,
    input.candidates,
    input.candidateIndex + 1,
  );
  if (!result.executed || result.terminal === undefined)
    return retainedCursorFor(
      state,
      input.cursor,
      restoredBranch,
      restorationLease,
    );
  return afterExecutedCandidate({
    ...input,
    state,
    nextCandidateIndex: input.candidateIndex + 1,
    terminal: result.terminal,
  });
};
