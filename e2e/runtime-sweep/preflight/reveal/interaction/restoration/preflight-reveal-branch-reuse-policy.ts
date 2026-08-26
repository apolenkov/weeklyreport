import type { VerifiedBranchRestorationLease } from "../evidence/preflight-reveal-operation-recorder.ts";
import {
  type RevealBranch,
  type RevealCandidate,
  revealCandidateAlreadyProcessed,
  type RevealCandidateTerminalResult,
  type RevealDiscoveryState,
  type RevealQueueChunkResult,
} from "../preflight-reveal-branches.ts";

export type CandidateLoopCursor = Readonly<{
  readonly state: RevealDiscoveryState;
  readonly restoredBranch?: RevealBranch;
  readonly restorationLease?: VerifiedBranchRestorationLease;
  readonly restorationScope?: "generic" | "branch-local";
}>;

export type CandidateIterationResult = Readonly<{
  readonly cursor: CandidateLoopCursor;
  readonly yielded?: RevealQueueChunkResult;
}>;

export type RevealBranchReusePolicy = Readonly<{
  readonly canReuseFor: (input: {
    readonly branch: RevealBranch;
    readonly candidate: RevealCandidate;
  }) => boolean;
  readonly restoreAfter: (input: {
    readonly branch: RevealBranch;
    readonly terminal: RevealCandidateTerminalResult;
  }) => Promise<VerifiedBranchRestorationLease | undefined>;
}>;

const nextPendingCandidateFor = (input: {
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
}): RevealCandidate | undefined =>
  input.candidates
    .slice(input.nextCandidateIndex)
    .find(
      (candidate) =>
        !revealCandidateAlreadyProcessed(input.state, input.current, candidate),
    );

export const restorationLeaseForCandidate = (input: {
  readonly policy?: RevealBranchReusePolicy;
  readonly current: RevealBranch;
  readonly candidate: RevealCandidate;
  readonly restorationLease?: VerifiedBranchRestorationLease;
  readonly restorationScope?: CandidateLoopCursor["restorationScope"];
}): VerifiedBranchRestorationLease | undefined =>
  input.restorationLease === undefined ||
  (input.restorationScope === "branch-local" &&
    input.policy !== undefined &&
    !input.policy.canReuseFor({
      branch: input.current,
      candidate: input.candidate,
    }))
    ? undefined
    : input.restorationLease;

export const restorationLeaseAfterTerminal = async (input: {
  readonly policy?: RevealBranchReusePolicy;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly terminal: RevealCandidateTerminalResult;
}): Promise<VerifiedBranchRestorationLease | undefined> => {
  if (input.policy === undefined) return undefined;
  const nextCandidate = nextPendingCandidateFor(input);
  if (
    nextCandidate === undefined ||
    !input.policy.canReuseFor({
      branch: input.current,
      candidate: nextCandidate,
    })
  )
    return undefined;
  return input.policy.restoreAfter({
    branch: input.current,
    terminal: input.terminal,
  });
};
