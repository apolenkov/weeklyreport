import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import {
  type RevealBranch,
  type RevealCandidate,
  revealCandidateAlreadyProcessed,
  type RevealCandidateTerminalResult,
  type RevealDiscoveryState,
  type RevealPureQueueInput,
  type RevealQueueChunkResult,
  type RevealQueueInput,
} from "./preflight-reveal-branches.ts";
import {
  type CandidateProcessor,
  processCandidateAtFailureBoundary,
} from "./preflight-reveal-queue-failure-boundary.ts";
import { yieldAfterTerminal } from "./preflight-reveal-queue-yield.ts";
import { RevealDiscoveryError } from "./preflight-reveal-types.ts";

export type RevealContinuation = Readonly<{
  readonly state: RevealDiscoveryState;
  readonly currentBranch: RevealBranch;
  readonly remainingQueue: readonly RevealBranch[];
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
}>;

export type RevealQueueYieldInput = Readonly<{
  readonly state: RevealDiscoveryState;
  readonly currentBranch: RevealBranch;
  readonly remainingQueue: readonly RevealBranch[];
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly terminal: RevealCandidateTerminalResult;
  readonly continuation?: RevealContinuation;
}>;

export type RevealQueueYieldHandler = (
  input: RevealQueueYieldInput,
) => Promise<boolean> | boolean;

export type RevealCandidateProcessingResult = Readonly<{
  state: RevealDiscoveryState;
  yielded?: RevealQueueChunkResult;
}>;

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

const terminalContinuationFor = (input: {
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
}): RevealContinuation | undefined =>
  input.nextCandidateIndex < input.candidates.length
    ? undefined
    : nextContinuationFor(input.queueInput, input.state);

const processExecutedCandidate = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly terminal: RevealCandidateTerminalResult;
  readonly shouldYieldAfterCandidate?: RevealQueueYieldHandler;
}): Promise<RevealQueueChunkResult | undefined> => {
  const continuation = terminalContinuationFor({
    queueInput: input.queueInput,
    state: input.state,
    candidates: input.candidates,
    nextCandidateIndex: input.nextCandidateIndex,
  });
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

export const processCandidates = async (
  input: {
    readonly queueInput: RevealQueueInput;
    readonly state: RevealDiscoveryState;
    readonly current: RevealBranch;
    readonly candidates: readonly RevealCandidate[];
    readonly index: number;
    readonly restoredBranch?: RevealBranch;
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
    shouldYieldAfterCandidate,
  } = input;
  const cursor: {
    state: RevealDiscoveryState;
    restoredBranch: RevealBranch | undefined;
  } = { state: input.state, restoredBranch };
  for (const [offset] of candidates.slice(index).entries()) {
    const candidateIndex = index + offset;
    const candidate = requiredCandidateAt(candidates, candidateIndex);
    const result = await processCandidateAtFailureBoundary({
      queueInput,
      current,
      state: cursor.state,
      candidates,
      candidateIndex,
      candidate,
      ...(cursor.restoredBranch === undefined
        ? {}
        : { restoredBranch: cursor.restoredBranch }),
      processCandidate,
    });
    cursor.state = candidateCursorState(
      result.state,
      current,
      candidates,
      candidateIndex + 1,
    );
    if (!result.executed || result.terminal === undefined) continue;
    cursor.restoredBranch = undefined;
    const yielded = await processExecutedCandidate({
      queueInput,
      state: cursor.state,
      current,
      candidates,
      nextCandidateIndex: candidateIndex + 1,
      terminal: result.terminal,
      ...(shouldYieldAfterCandidate === undefined
        ? {}
        : { shouldYieldAfterCandidate }),
    });
    if (yielded !== undefined) return { state: cursor.state, yielded };
  }
  const {
    currentBranch: _currentBranch,
    currentCandidates: _currentCandidates,
    currentCandidateIndex: _currentCandidateIndex,
    ...withoutCursor
  } = cursor.state;
  return { state: { ...withoutCursor, queue: cursor.state.queue } };
};
