import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
  RevealDiscoveryState,
  RevealQueueChunkResult,
} from "./preflight-reveal-branches.ts";
import type {
  RevealContinuation,
  RevealQueueYieldHandler,
} from "./preflight-reveal-queue-candidates.ts";

export const yieldAfterTerminal = async (input: {
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly terminal: RevealCandidateTerminalResult;
  readonly shouldYieldAfterCandidate?: RevealQueueYieldHandler;
  readonly continuation?: RevealContinuation;
}): Promise<RevealQueueChunkResult | undefined> => {
  const shouldYield = await input.shouldYieldAfterCandidate?.({
    state: input.state,
    currentBranch: input.current,
    remainingQueue: input.state.queue,
    candidates: input.candidates,
    nextCandidateIndex: input.nextCandidateIndex,
    terminal: input.terminal,
    ...(input.continuation === undefined
      ? {}
      : { continuation: input.continuation }),
  });
  if (shouldYield !== true) return undefined;
  if (input.continuation !== undefined)
    return { ...input.continuation, completed: false };
  if (input.nextCandidateIndex >= input.candidates.length) return undefined;
  return {
    state: input.state,
    completed: false,
    currentBranch: input.current,
    remainingQueue: input.state.queue,
    candidates: input.candidates,
    nextCandidateIndex: input.nextCandidateIndex,
  };
};
