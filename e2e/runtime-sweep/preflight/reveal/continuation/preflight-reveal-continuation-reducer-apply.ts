import { stableSerialize } from "../../../support/ids.ts";
import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealDiscoveryState,
  RevealPureQueueInput,
} from "../interaction/preflight-reveal-branches.ts";
import { applyRevealCandidateResult } from "../interaction/preflight-reveal-queue.ts";
import {
  candidatesAtBoundary,
  nextContinuationFor,
  type RevealContinuation,
} from "../interaction/preflight-reveal-queue-candidates.ts";
import { rememberedRevealContinuationAsset } from "./preflight-reveal-continuation-assets.ts";
import { canonicalCandidatesForList } from "./preflight-reveal-continuation-candidates.ts";
import { RevealContinuationReplayError } from "./preflight-reveal-continuation-errors.ts";
import type { RevealContinuationReceipt } from "./preflight-reveal-continuation-schemas.ts";
import { PREFLIGHT_REVEAL_CANDIDATE_LIST } from "./preflight-reveal-continuation-schemas.ts";
import { assertReceiptContract } from "./preflight-reveal-continuation-validators.ts";
import { revealCandidateIdentityFor } from "./receipts/preflight-reveal-continuation-receipt-assets.ts";
import {
  assertTerminalReceiptSemantics,
  branchForRef,
  terminalBranchFor,
} from "./receipts/preflight-reveal-continuation-receipts.ts";

export type RevealReducerInput = RevealPureQueueInput;

const branchFromReceipt = (
  receipt: RevealContinuationReceipt,
): RevealBranch => {
  const branch = branchForRef(receipt.branchRef);
  if (
    branch.path.digest !== receipt.pathDigest ||
    receipt.branchRef !== receipt.branchDigest
  )
    throw new RevealContinuationReplayError(
      "R188 receipt branch reference drifted",
    );
  return branch;
};

const assertReceiptFrontier = (input: {
  readonly state: RevealDiscoveryState;
  readonly branch: RevealBranch;
}): void => {
  const expectedBranch = input.state.currentBranch ?? input.state.queue.at(0);
  if (expectedBranch === undefined)
    throw new RevealContinuationReplayError(
      "R188 reducer state has no frontier branch",
    );
  if (
    expectedBranch.path.digest !== input.branch.path.digest ||
    stableSerialize(expectedBranch.surface) !==
      stableSerialize(input.branch.surface) ||
    stableSerialize(expectedBranch.inventory) !==
      stableSerialize(input.branch.inventory) ||
    expectedBranch.url !== input.branch.url
  )
    throw new RevealContinuationReplayError(
      "R188 receipt branch is not the reducer frontier",
    );
};

const candidateListForRef = (ref: string) => {
  const candidateList = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
    ref,
  });
  if (candidateList?.artifact !== PREFLIGHT_REVEAL_CANDIDATE_LIST)
    throw new RevealContinuationReplayError(
      "R188 receipt candidate list content reference is unavailable",
    );
  return candidateList;
};

const assertCandidateBinding = (input: {
  readonly branch: RevealBranch;
  readonly receipt: RevealContinuationReceipt;
  readonly candidate: RevealCandidate;
}): void => {
  const expectedId = revealCandidateIdentityFor({
    branch: input.branch,
    candidate: input.candidate,
  });
  if (
    input.receipt.candidateId !== expectedId ||
    stableSerialize(input.candidate.action) !==
      stableSerialize(input.receipt.action) ||
    stableSerialize(input.candidate.representativeInput ?? null) !==
      stableSerialize(input.receipt.representativeInput)
  )
    throw new RevealContinuationReplayError(
      `R188 receipt candidate identity drifted (candidate=${expectedId}/${input.receipt.candidateId})`,
    );
};

const assertReceiptCandidate = (input: {
  readonly queueInput: RevealReducerInput;
  readonly state: RevealDiscoveryState;
  readonly branch: RevealBranch;
  readonly receipt: RevealContinuationReceipt;
}) => {
  assertReceiptFrontier({ state: input.state, branch: input.branch });
  const derivedCandidates =
    input.state.currentBranch?.path.digest === input.branch.path.digest &&
    input.state.currentCandidates !== undefined
      ? input.state.currentCandidates
      : candidatesForImmediateReveal(input.queueInput, input.branch);
  const expectedIndex =
    input.state.currentBranch?.path.digest === input.branch.path.digest
      ? (input.state.currentCandidateIndex ?? 0)
      : 0;
  if (input.receipt.candidateIndex !== expectedIndex)
    throw new RevealContinuationReplayError(
      `R188 receipt candidate index is not the reducer cursor: expected=${String(expectedIndex)} actual=${String(input.receipt.candidateIndex)}`,
    );
  const candidateList = candidateListForRef(input.receipt.candidateListRef);
  const candidates = canonicalCandidatesForList({
    branch: input.branch,
    branchDigest: input.receipt.branchDigest,
    candidates: derivedCandidates,
    candidateList,
    candidateListDigest: input.receipt.candidateListDigest,
  });
  const candidate = candidates[input.receipt.candidateIndex];
  if (candidate === undefined)
    throw new RevealContinuationReplayError(
      "R188 receipt candidate index is outside the canonical candidate list",
    );
  assertCandidateBinding({
    branch: input.branch,
    receipt: input.receipt,
    candidate,
  });
  return { candidates, candidate };
};

const stateForCanonicalNext = (input: {
  readonly next: RevealContinuation;
  readonly nextFrontier: NonNullable<RevealContinuationReceipt["nextFrontier"]>;
}): RevealDiscoveryState => {
  if (input.nextFrontier.branchRef !== input.nextFrontier.branchDigest)
    throw new RevealContinuationReplayError(
      "R188 receipt lacks its canonical next frontier",
    );
  const recordedBranch = branchForRef(input.nextFrontier.branchRef);
  if (
    recordedBranch.path.digest !== input.next.currentBranch.path.digest ||
    stableSerialize(recordedBranch.surface) !==
      stableSerialize(input.next.currentBranch.surface) ||
    stableSerialize(recordedBranch.inventory) !==
      stableSerialize(input.next.currentBranch.inventory) ||
    recordedBranch.url !== input.next.currentBranch.url
  )
    throw new RevealContinuationReplayError(
      "R188 receipt next frontier branch drifted",
    );
  const candidates = canonicalCandidatesForList({
    branch: input.next.currentBranch,
    branchDigest: input.nextFrontier.branchDigest,
    candidates: input.next.candidates,
    candidateList: candidateListForRef(input.nextFrontier.candidateListRef),
    candidateListDigest: input.nextFrontier.candidateListDigest,
  });
  return { ...input.next.state, currentCandidates: candidates };
};

const stateAfterBoundaryFor = (input: {
  readonly queueInput: RevealReducerInput;
  readonly transitioned: RevealDiscoveryState;
  readonly branch: RevealBranch;
  readonly receipt: RevealContinuationReceipt;
  readonly candidates: readonly RevealCandidate[];
}): RevealDiscoveryState => {
  const sameBranch = candidatesAtBoundary(
    input.queueInput,
    input.transitioned,
    input.branch,
    input.transitioned.queue,
    input.candidates,
  );
  if (sameBranch !== undefined) {
    if (input.receipt.nextFrontier !== null)
      throw new RevealContinuationReplayError(
        "R188 receipt declares a next frontier before its branch is exhausted",
      );
    return sameBranch.state;
  }
  const next = nextContinuationFor(input.queueInput, input.transitioned);
  if (next !== undefined) {
    const nextFrontier = input.receipt.nextFrontier;
    if (nextFrontier === null) return next.state;
    return stateForCanonicalNext({ next, nextFrontier });
  }
  if (input.receipt.nextFrontier !== null)
    throw new RevealContinuationReplayError(
      "R188 receipt declares a next frontier after reducer completion",
    );
  const {
    currentBranch: _currentBranch,
    currentCandidates: _currentCandidates,
    currentCandidateIndex: _currentCandidateIndex,
    ...withoutCursor
  } = input.transitioned;
  return { ...withoutCursor, queue: [] };
};

const stateForReceipt = (input: {
  readonly queueInput: RevealReducerInput;
  readonly state: RevealDiscoveryState;
  readonly branch: RevealBranch;
  readonly afterBranch: RevealBranch;
  readonly receipt: RevealContinuationReceipt;
  readonly candidates: readonly RevealCandidate[];
  readonly candidate: RevealCandidate;
}): RevealDiscoveryState => {
  const queueWithoutBranch = input.state.queue.filter(
    (candidateBranch) =>
      candidateBranch.path.digest !== input.branch.path.digest,
  );
  const transitioned = applyRevealCandidateResult({
    input: input.queueInput,
    state: {
      ...input.state,
      queue: queueWithoutBranch,
      currentBranch: input.branch,
      currentCandidates: input.candidates,
      currentCandidateIndex: input.receipt.candidateIndex,
    },
    current: input.branch,
    terminal: {
      candidate: input.candidate,
      result: {
        branch: input.afterBranch,
        transition: input.receipt.transition,
        explore: input.receipt.materialChanged,
      },
      candidateIndex: input.receipt.candidateIndex,
      materialChanged: input.receipt.materialChanged,
    },
  });
  return stateAfterBoundaryFor({
    queueInput: input.queueInput,
    transitioned,
    branch: input.branch,
    receipt: input.receipt,
    candidates: input.candidates,
  });
};

export const applyReceipt = (input: {
  readonly queueInput: RevealReducerInput;
  readonly state: RevealDiscoveryState;
  readonly receipt: RevealContinuationReceipt;
  readonly completedCandidateCount: number;
}): Readonly<{
  readonly state: RevealDiscoveryState;
  readonly count: number;
}> => {
  const { queueInput, state, receipt } = input;
  assertReceiptContract(receipt);
  assertTerminalReceiptSemantics(receipt);
  const branch = branchFromReceipt(receipt);
  const { candidates, candidate } = assertReceiptCandidate({
    queueInput,
    state,
    branch,
    receipt,
  });
  const afterBranch = terminalBranchFor(receipt);
  const expectedMaterialChanged =
    afterBranch.path.digest !== branch.path.digest;
  if (receipt.materialChanged !== expectedMaterialChanged)
    throw new RevealContinuationReplayError(
      "R188 receipt material flag does not match the terminal branch",
    );
  const expectedActionCount = state.actionCount + branch.path.steps.length + 1;
  const expectedBranchCount =
    state.branchCount + (expectedMaterialChanged ? 1 : 0);
  const expectedCompletedCandidateCount = input.completedCandidateCount + 1;
  if (
    receipt.actionCount !== expectedActionCount ||
    receipt.branchCount !== expectedBranchCount ||
    receipt.completedCandidateCount !== expectedCompletedCandidateCount ||
    receipt.sequence !== expectedCompletedCandidateCount
  )
    throw new RevealContinuationReplayError(
      "R188 receipt counters do not match the reducer-derived transition",
    );
  return {
    state: stateForReceipt({
      queueInput,
      state,
      branch,
      afterBranch,
      receipt,
      candidates,
      candidate,
    }),
    count: expectedCompletedCandidateCount,
  };
};
