import type { Action } from "../../../../source/contracts.ts";
import { sha256Hex } from "../../../../support/ids.ts";
import type { RevealNonMutationProof } from "../../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
} from "../preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "../preflight-reveal-candidate-identity.ts";
import { RevealDiscoveryError } from "../preflight-reveal-types.ts";

const LEASE_OWNER = Symbol("reveal-restoration-lease-owner");

type RevealBranchOperationProof = Readonly<{
  pathDigest: string;
  surfaceDigest: string;
  inventory: RevealBranch["inventory"];
  url: string;
}>;

type RevealCandidateOperationEvent = Readonly<{
  candidateId: string;
  source: RevealBranchOperationProof;
  preparation: "FULL_REPLAY" | "INVERSE_LEASE";
  replayStepDigests: readonly string[];
  candidateActionDigest: string;
  consumedLeaseId: string | null;
}>;

type RevealInverseRestorationEvent = Readonly<{
  leaseId: string;
  afterCandidateId: string;
  inverseAction: Action;
  ariaControlsTarget: string;
  source: RevealBranchOperationProof;
  terminal: RevealBranchOperationProof;
  restored: RevealBranchOperationProof;
  nonMutation: RevealNonMutationProof;
  consumedByCandidateId: string | null;
}>;

export type RevealOperationRecorderSnapshot = Readonly<{
  childExecutionId: string;
  childOrdinal: number;
  candidateOperations: readonly RevealCandidateOperationEvent[];
  inverseRestorations: readonly RevealInverseRestorationEvent[];
}>;

export type VerifiedBranchRestorationLease = Readonly<{
  readonly leaseId: string;
  readonly branch: RevealBranch;
  readonly [LEASE_OWNER]: symbol;
}>;

export const revealRestorationLeaseIdFor = (input: {
  readonly childExecutionId: string;
  readonly childOrdinal: number;
  readonly producerCandidateId: string;
  readonly restorationSequence: number;
}): string =>
  sha256Hex({
    childExecutionId: input.childExecutionId,
    childOrdinal: input.childOrdinal,
    afterCandidateId: input.producerCandidateId,
    sequence: input.restorationSequence,
  });

export type RevealOperationRecorder = Readonly<{
  recordReplayStep: (stepDigest: string) => void;
  recordCandidate: (input: {
    readonly source: RevealBranch;
    readonly candidate: RevealCandidate;
    readonly lease?: VerifiedBranchRestorationLease;
  }) => void;
  createRestorationLease: (input: {
    readonly source: RevealBranch;
    readonly terminal: RevealBranch;
    readonly restored: RevealBranch;
    readonly candidate: RevealCandidate;
    readonly inverseAction: Action;
    readonly ariaControlsTarget: string;
    readonly nonMutation: RevealNonMutationProof;
  }) => VerifiedBranchRestorationLease;
  branchForLease: (lease: VerifiedBranchRestorationLease) => RevealBranch;
  snapshot: () => RevealOperationRecorderSnapshot;
}>;

const branchProofFor = (branch: RevealBranch): RevealBranchOperationProof => ({
  pathDigest: branch.path.digest,
  surfaceDigest: branch.surface.digest,
  inventory: branch.inventory,
  url: branch.url,
});

interface RecorderState {
  readonly childExecutionId: string;
  readonly childOrdinal: number;
  readonly owner: symbol;
  readonly replayStepDigests: string[];
  readonly candidateOperations: RevealCandidateOperationEvent[];
  readonly inverseRestorations: RevealInverseRestorationEvent[];
  readonly openLeases: Map<string, VerifiedBranchRestorationLease>;
}

const requiredOwnedLease = (
  state: RecorderState,
  lease: VerifiedBranchRestorationLease,
): VerifiedBranchRestorationLease => {
  if (
    lease[LEASE_OWNER] !== state.owner ||
    state.openLeases.get(lease.leaseId) !== lease
  )
    throw new RevealDiscoveryError(
      "Branch-local restoration lease is stale or cross-recorder",
    );
  return lease;
};

const recordCandidate = (
  state: RecorderState,
  input: Parameters<RevealOperationRecorder["recordCandidate"]>[0],
): void => {
  const { source, candidate, lease } = input;
  const candidateId = revealCandidateIdentityFor({ branch: source, candidate });
  if (lease === undefined && state.openLeases.size > 0)
    throw new RevealDiscoveryError(
      "Candidate bypassed an open branch-local restoration lease",
    );
  const consumed =
    lease === undefined ? undefined : requiredOwnedLease(state, lease);
  if (consumed !== undefined) {
    if (state.replayStepDigests.length > 0)
      throw new RevealDiscoveryError(
        "Inverse lease candidate unexpectedly performed full replay",
      );
    state.openLeases.delete(consumed.leaseId);
    const index = state.inverseRestorations.findIndex(
      ({ leaseId }) => leaseId === consumed.leaseId,
    );
    const restoration = state.inverseRestorations[index];
    if (restoration?.consumedByCandidateId !== null)
      throw new RevealDiscoveryError(
        "Branch-local restoration lease consumption drifted",
      );
    state.inverseRestorations[index] = {
      ...restoration,
      consumedByCandidateId: candidateId,
    };
  }
  state.candidateOperations.push({
    candidateId,
    source: branchProofFor(source),
    preparation: consumed === undefined ? "FULL_REPLAY" : "INVERSE_LEASE",
    replayStepDigests: state.replayStepDigests.splice(0),
    candidateActionDigest: sha256Hex(candidate.action),
    consumedLeaseId: consumed?.leaseId ?? null,
  });
};

const createRestorationLease = (
  state: RecorderState,
  input: Parameters<RevealOperationRecorder["createRestorationLease"]>[0],
): VerifiedBranchRestorationLease => {
  if (state.openLeases.size > 0 || state.replayStepDigests.length > 0)
    throw new RevealDiscoveryError(
      "Branch-local restoration lease boundary is not empty",
    );
  const afterCandidateId = revealCandidateIdentityFor({
    branch: input.source,
    candidate: input.candidate,
  });
  if (state.candidateOperations.at(-1)?.candidateId !== afterCandidateId)
    throw new RevealDiscoveryError(
      "Branch-local inverse does not follow its terminal candidate",
    );
  const leaseId = revealRestorationLeaseIdFor({
    childExecutionId: state.childExecutionId,
    childOrdinal: state.childOrdinal,
    producerCandidateId: afterCandidateId,
    restorationSequence: state.inverseRestorations.length + 1,
  });
  const lease: VerifiedBranchRestorationLease = {
    leaseId,
    branch: input.restored,
    [LEASE_OWNER]: state.owner,
  };
  state.openLeases.set(leaseId, lease);
  state.inverseRestorations.push({
    leaseId,
    afterCandidateId,
    inverseAction: input.inverseAction,
    ariaControlsTarget: input.ariaControlsTarget,
    source: branchProofFor(input.source),
    terminal: branchProofFor(input.terminal),
    restored: branchProofFor(input.restored),
    nonMutation: input.nonMutation,
    consumedByCandidateId: null,
  });
  return lease;
};

const snapshotFor = (state: RecorderState): RevealOperationRecorderSnapshot => {
  if (
    state.openLeases.size > 0 ||
    state.replayStepDigests.length > 0 ||
    state.inverseRestorations.some(
      ({ consumedByCandidateId }) => consumedByCandidateId === null,
    )
  )
    throw new RevealDiscoveryError(
      "Reveal operation evidence sealed with an open restoration boundary",
    );
  return {
    childExecutionId: state.childExecutionId,
    childOrdinal: state.childOrdinal,
    candidateOperations: state.candidateOperations,
    inverseRestorations: state.inverseRestorations,
  };
};

export const createRevealOperationRecorder = (input: {
  readonly childExecutionId: string;
  readonly childOrdinal: number;
}): RevealOperationRecorder => {
  const state: RecorderState = {
    childExecutionId: input.childExecutionId,
    childOrdinal: input.childOrdinal,
    owner: Symbol(input.childExecutionId),
    replayStepDigests: [],
    candidateOperations: [],
    inverseRestorations: [],
    openLeases: new Map(),
  };
  return {
    recordReplayStep: (stepDigest) => {
      if (state.openLeases.size > 0)
        throw new RevealDiscoveryError(
          "Full replay cannot cross an open branch-local restoration lease",
        );
      state.replayStepDigests.push(stepDigest);
    },
    recordCandidate: (candidateInput) => recordCandidate(state, candidateInput),
    createRestorationLease: (leaseInput) =>
      createRestorationLease(state, leaseInput),
    branchForLease: (lease) => requiredOwnedLease(state, lease).branch,
    snapshot: () => snapshotFor(state),
  };
};
