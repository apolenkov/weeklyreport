import {
  type RevealBranch,
  type RevealCandidate,
  type RevealCandidateTerminalResult,
  RevealCapacityOverflowError,
  type RevealDiscoveryState,
  type RevealQueueInput,
} from "./preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "./preflight-reveal-candidate-identity.ts";

export type CandidateProcessor = (input: {
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

export const processCandidateAtFailureBoundary = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly current: RevealBranch;
  readonly state: RevealDiscoveryState;
  readonly candidates: readonly RevealCandidate[];
  readonly candidateIndex: number;
  readonly candidate: RevealCandidate;
  readonly restoredBranch?: RevealBranch;
  readonly processCandidate: CandidateProcessor;
}): ReturnType<CandidateProcessor> => {
  const state = { ...input.state, currentCandidateIndex: input.candidateIndex };
  try {
    return await input.processCandidate({
      queueInput: input.queueInput,
      current: input.current,
      state,
      candidate: input.candidate,
      ...(input.restoredBranch === undefined
        ? {}
        : { restoredBranch: input.restoredBranch }),
    });
  } catch (originalError: unknown) {
    const handler = input.queueInput.onCandidateFailure;
    if (handler !== undefined)
      await Promise.allSettled([
        Promise.resolve().then(() =>
          handler({
            state,
            branch: input.current,
            candidates: input.candidates,
            candidateIndex: input.candidateIndex,
            candidateIdentity: revealCandidateIdentityFor({
              branch: input.current,
              candidate: input.candidate,
            }),
            ...(originalError instanceof RevealCapacityOverflowError
              ? { pendingBranch: originalError.branch }
              : {}),
            originalError,
          }),
        ),
      ]);
    throw originalError;
  }
};
