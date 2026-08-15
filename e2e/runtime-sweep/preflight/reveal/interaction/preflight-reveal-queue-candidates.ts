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

type CandidateProcessor = (input: {
  readonly queueInput: RevealQueueInput;
  readonly current: RevealBranch;
  readonly state: RevealDiscoveryState;
  readonly candidate: RevealCandidate;
  readonly restoredBranch?: RevealBranch;
}) => Promise<{
  readonly state: RevealDiscoveryState;
  readonly executed: boolean;
  readonly terminal?: RevealCandidateTerminalResult;
}>;

type QueueProcessor = (
  input: RevealQueueInput,
  state: RevealDiscoveryState,
  shouldYieldAfterCandidate?: RevealQueueYieldHandler,
) => Promise<RevealQueueChunkResult>;

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

const continueFromCursor = (
  input: {
    readonly queueInput: RevealQueueInput;
    readonly state: RevealDiscoveryState;
    readonly shouldYieldAfterCandidate?: RevealQueueYieldHandler;
  },
  processQueue: QueueProcessor,
): Promise<RevealQueueChunkResult> => {
  const {
    currentBranch: _currentBranch,
    currentCandidates: _currentCandidates,
    currentCandidateIndex: _currentCandidateIndex,
    ...withoutCursor
  } = input.state;
  return processQueue(
    input.queueInput,
    { ...withoutCursor, queue: input.state.queue },
    input.shouldYieldAfterCandidate,
  );
};

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
  processQueue: QueueProcessor,
): Promise<RevealQueueChunkResult> => {
  const {
    queueInput,
    state,
    current,
    candidates,
    index,
    restoredBranch,
    shouldYieldAfterCandidate,
  } = input;
  if (index >= candidates.length)
    return continueFromCursor(input, processQueue);
  const candidate = candidates[index];
  if (candidate === undefined)
    throw new RevealDiscoveryError(
      `Reveal candidate ${String(index)} is missing from its ordered list`,
    );
  const result = await processCandidate({
    queueInput,
    current,
    state: { ...state, currentCandidateIndex: index },
    candidate,
    ...(restoredBranch === undefined ? {} : { restoredBranch }),
  });
  const processed: RevealDiscoveryState = {
    ...result.state,
    currentBranch: current,
    currentCandidates: candidates,
    currentCandidateIndex: index + 1,
  };
  if (!result.executed || result.terminal === undefined)
    return processNext(
      { ...input, state: processed, index: index + 1 },
      processCandidate,
      processQueue,
    );
  const yielded = await processExecutedCandidate({
    queueInput,
    state: processed,
    current,
    candidates,
    nextCandidateIndex: index + 1,
    terminal: result.terminal,
    ...(shouldYieldAfterCandidate === undefined
      ? {}
      : { shouldYieldAfterCandidate }),
  });
  if (yielded !== undefined) return yielded;
  const { restoredBranch: _restoredBranch, ...inputWithoutRestoredBranch } =
    input;
  return processNext(
    { ...inputWithoutRestoredBranch, state: processed, index: index + 1 },
    processCandidate,
    processQueue,
  );
};

function processNext(
  input: Parameters<typeof processCandidates>[0],
  processCandidate: CandidateProcessor,
  processQueue: QueueProcessor,
): Promise<RevealQueueChunkResult> {
  return processCandidates(input, processCandidate, processQueue);
}
