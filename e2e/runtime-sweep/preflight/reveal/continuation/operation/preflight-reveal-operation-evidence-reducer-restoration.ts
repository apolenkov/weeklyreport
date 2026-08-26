import { sha256Hex, stableSerialize } from "../../../../support/ids.ts";
import { isUnchangedRevealNonMutationProof } from "../../../reveal-path.ts";
import { revealRestorationLeaseIdFor } from "../../interaction/evidence/preflight-reveal-operation-recorder.ts";
import { revealCandidateIdentityFor } from "../../interaction/preflight-reveal-candidate-identity.ts";
import {
  canReuseRevealBranchForCandidate,
  inverseRestorationBindingFor,
} from "../../interaction/restoration/preflight-reveal-branch-local-restoration.ts";
import type {
  RevealContinuationReceipt,
  RevealReceiptChunk,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import { serializableInventoryFor } from "../preflight-reveal-continuation-inventory.ts";
import type { RevealReducerInput } from "../preflight-reveal-continuation-reducer.ts";
import {
  branchForRef,
  terminalBranchFor,
} from "../receipts/preflight-reveal-continuation-receipts.ts";

type OperationEvidence = RevealReceiptChunk["operationEvidence"];
type Branch = ReturnType<typeof branchForRef>;

const branchProofFor = (
  branch: Branch,
): OperationEvidence["candidateOperations"][number]["source"] => ({
  pathDigest: branch.path.digest,
  surfaceDigest: branch.surface.digest,
  inventoryDigest: sha256Hex(serializableInventoryFor(branch.inventory)),
  url: branch.url,
});

const assertBranchProof = (input: {
  readonly actual: OperationEvidence["candidateOperations"][number]["source"];
  readonly branch: Branch;
  readonly label: string;
}): void => {
  if (
    stableSerialize(input.actual) !==
    stableSerialize(branchProofFor(input.branch))
  )
    throw new Error(`R188 operation ${input.label} branch proof drifted`);
};

const candidateForReceipt = (input: {
  readonly queueInput: RevealReducerInput;
  readonly receipt: RevealContinuationReceipt;
}) => {
  const branch = branchForRef(input.receipt.branchRef);
  const matches = input.queueInput
    .candidatesFor(branch.inventory)
    .filter(
      (candidate) =>
        revealCandidateIdentityFor({ branch, candidate }) ===
        input.receipt.candidateId,
    );
  if (matches.length !== 1)
    throw new Error("R188 operation evidence candidate cannot be re-derived");
  const candidate = matches[0];
  if (candidate === undefined)
    throw new Error("R188 operation evidence candidate is unavailable");
  return { branch, candidate };
};

const assertBranchReuseEligibility = (input: {
  readonly branch: Branch;
  readonly candidate: ReturnType<typeof candidateForReceipt>["candidate"];
  readonly label: string;
}): void => {
  if (!canReuseRevealBranchForCandidate(input.branch, input.candidate))
    throw new Error(
      `R188 operation ${input.label} is not an eligible source-bound row-local toggle`,
    );
};

const receiptsByDigest = (
  receipts: readonly RevealContinuationReceipt[],
): ReadonlyMap<string, RevealContinuationReceipt> => {
  const result = new Map<string, RevealContinuationReceipt>();
  for (const receipt of receipts) {
    if (result.has(receipt.digest))
      throw new Error("R188 operation evidence has duplicate receipt digests");
    result.set(receipt.digest, receipt);
  }
  return result;
};

const assertLeaseConsumer = (input: {
  readonly evidence: OperationEvidence;
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly restoration: OperationEvidence["inverseRestorations"][number];
  readonly afterIndex: number;
  readonly consumer: RevealContinuationReceipt;
}): OperationEvidence["candidateOperations"][number] => {
  if (input.receipts[input.afterIndex + 1]?.digest !== input.consumer.digest)
    throw new Error("R188 restoration lease is not immediately consumed");
  const consumedOperation =
    input.evidence.candidateOperations[input.afterIndex + 1];
  if (
    consumedOperation?.preparation !== "INVERSE_LEASE" ||
    consumedOperation.consumedLeaseId !== input.restoration.leaseId
  )
    throw new Error("R188 restoration lease consumer drifted");
  return consumedOperation;
};

const assertProducerLease = (input: {
  readonly evidence: OperationEvidence;
  readonly queueInput: RevealReducerInput;
  readonly restoration: OperationEvidence["inverseRestorations"][number];
  readonly after: RevealContinuationReceipt;
  readonly afterIndex: number;
  readonly restorationSequence: number;
}): Branch => {
  const producerOperation =
    input.evidence.candidateOperations[input.afterIndex];
  if (producerOperation === undefined)
    throw new Error("R188 restoration producer operation is unavailable");
  const expectedLeaseId = revealRestorationLeaseIdFor({
    childExecutionId: input.evidence.childExecutionId,
    childOrdinal: input.evidence.childOrdinal,
    producerCandidateId: producerOperation.candidateId,
    restorationSequence: input.restorationSequence,
  });
  if (input.restoration.leaseId !== expectedLeaseId)
    throw new Error("R188 restoration lease provenance drifted");
  const { branch: source, candidate } = candidateForReceipt({
    queueInput: input.queueInput,
    receipt: input.after,
  });
  if (
    producerOperation.candidateId !==
    revealCandidateIdentityFor({ branch: source, candidate })
  )
    throw new Error("R188 restoration producer candidate identity drifted");
  assertBranchReuseEligibility({
    branch: source,
    candidate,
    label: "producer",
  });
  const terminal = terminalBranchFor(input.after);
  assertBranchProof({
    actual: input.restoration.source,
    branch: source,
    label: "source",
  });
  assertBranchProof({
    actual: input.restoration.terminal,
    branch: terminal,
    label: "terminal",
  });
  assertBranchProof({
    actual: input.restoration.restored,
    branch: source,
    label: "restored",
  });
  const expected = inverseRestorationBindingFor({
    source,
    candidate,
    terminalBranch: terminal,
  });
  if (
    stableSerialize(input.restoration.inverseAction) !==
      stableSerialize(expected.action) ||
    input.restoration.ariaControlsTarget !== expected.target ||
    !isUnchangedRevealNonMutationProof(input.restoration.nonMutation)
  )
    throw new Error("R188 inverse restoration proof drifted");
  return source;
};

const assertConsumerLease = (input: {
  readonly queueInput: RevealReducerInput;
  readonly evidence: OperationEvidence;
  readonly restoration: OperationEvidence["inverseRestorations"][number];
  readonly consumer: RevealContinuationReceipt;
  readonly consumedOperation: OperationEvidence["candidateOperations"][number];
  readonly source: Branch;
}): void => {
  const { branch: consumerSource, candidate: consumerCandidate } =
    candidateForReceipt({
      queueInput: input.queueInput,
      receipt: input.consumer,
    });
  if (
    stableSerialize(branchProofFor(consumerSource)) !==
      stableSerialize(input.restoration.restored) ||
    stableSerialize(input.consumedOperation.source) !==
      stableSerialize(input.restoration.restored) ||
    stableSerialize(branchProofFor(consumerSource)) !==
      stableSerialize(branchProofFor(input.source))
  )
    throw new Error(
      "R188 restoration consumer is not bound to the restored source",
    );
  assertBranchReuseEligibility({
    branch: consumerSource,
    candidate: consumerCandidate,
    label: "consumer",
  });
  try {
    inverseRestorationBindingFor({
      source: consumerSource,
      candidate: consumerCandidate,
      terminalBranch: terminalBranchFor(input.consumer),
    });
  } catch (error: unknown) {
    throw new Error(
      `R188 restoration consumer toggle is not source-bound and URL-stable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const assertInverseRestoration = (input: {
  readonly queueInput: RevealReducerInput;
  readonly evidence: OperationEvidence;
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly restoration: OperationEvidence["inverseRestorations"][number];
  readonly byDigest: ReadonlyMap<string, RevealContinuationReceipt>;
  readonly restorationSequence: number;
  readonly previousProducerReceiptIndex: number;
}): number => {
  const after = input.byDigest.get(input.restoration.afterReceiptDigest);
  const consumer = input.byDigest.get(
    input.restoration.consumedByReceiptDigest,
  );
  if (after === undefined || consumer === undefined)
    throw new Error("R188 restoration receipt binding is unavailable");
  const afterIndex = input.receipts.indexOf(after);
  if (afterIndex <= input.previousProducerReceiptIndex)
    throw new Error("R188 restoration producer sequence is not canonical");
  const consumedOperation = assertLeaseConsumer({
    evidence: input.evidence,
    receipts: input.receipts,
    restoration: input.restoration,
    afterIndex,
    consumer,
  });
  const source = assertProducerLease({
    evidence: input.evidence,
    queueInput: input.queueInput,
    restoration: input.restoration,
    after,
    afterIndex,
    restorationSequence: input.restorationSequence,
  });
  assertConsumerLease({
    queueInput: input.queueInput,
    evidence: input.evidence,
    restoration: input.restoration,
    consumer,
    consumedOperation,
    source,
  });
  return afterIndex;
};

export const assertInverseRestorations = (input: {
  readonly queueInput: RevealReducerInput;
  readonly evidence: OperationEvidence;
  readonly receipts: readonly RevealContinuationReceipt[];
}): void => {
  const byDigest = receiptsByDigest(input.receipts);
  const leases = new Set<string>();
  const producerIndexes = input.evidence.inverseRestorations.map(
    (restoration) => {
      const receipt = byDigest.get(restoration.afterReceiptDigest);
      return receipt === undefined ? -1 : input.receipts.indexOf(receipt);
    },
  );
  for (const [
    index,
    restoration,
  ] of input.evidence.inverseRestorations.entries()) {
    if (leases.has(restoration.leaseId))
      throw new Error("R188 operation evidence repeats a restoration lease");
    leases.add(restoration.leaseId);
    assertInverseRestoration({
      ...input,
      restoration,
      byDigest,
      restorationSequence: index + 1,
      previousProducerReceiptIndex: producerIndexes[index - 1] ?? -1,
    });
  }
  const consumedLeaseIds = input.evidence.candidateOperations
    .map(({ consumedLeaseId }) => consumedLeaseId)
    .filter((leaseId): leaseId is string => leaseId !== null);
  if (
    consumedLeaseIds.length !== leases.size ||
    consumedLeaseIds.some((leaseId) => !leases.has(leaseId))
  )
    throw new Error("R188 operation evidence has an open or foreign lease");
};
