import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
  RevealDiscoveryState,
  RevealQueueChunkResult,
} from "../preflight-reveal-branches.ts";

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
