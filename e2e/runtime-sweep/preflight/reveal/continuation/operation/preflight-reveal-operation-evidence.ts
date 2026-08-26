import { sha256Hex } from "../../../../support/ids.ts";
import type { RevealOperationRecorderSnapshot } from "../../interaction/evidence/preflight-reveal-operation-recorder.ts";
import type {
  RevealContinuationReceipt,
  RevealReceiptChunk,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import { operationEvidenceDigestForBody } from "../preflight-reveal-continuation-digests.ts";
import { serializableInventoryFor } from "../preflight-reveal-continuation-inventory.ts";

type OperationEvidence = RevealReceiptChunk["operationEvidence"];
type BranchProof = OperationEvidence["candidateOperations"][number]["source"];

const durableBranchProofFor = (input: {
  readonly pathDigest: string;
  readonly surfaceDigest: string;
  readonly inventory: Parameters<typeof serializableInventoryFor>[0];
  readonly url: string;
}): BranchProof => ({
  pathDigest: input.pathDigest,
  surfaceDigest: input.surfaceDigest,
  inventoryDigest: sha256Hex(serializableInventoryFor(input.inventory)),
  url: input.url,
});

const receiptByCandidateId = (
  receipts: readonly RevealContinuationReceipt[],
): ReadonlyMap<string, RevealContinuationReceipt> => {
  const result = new Map<string, RevealContinuationReceipt>();
  for (const receipt of receipts) {
    if (result.has(receipt.candidateId))
      throw new Error("Operation evidence has a duplicate candidate identity");
    result.set(receipt.candidateId, receipt);
  }
  return result;
};

const candidateOperationsFor = (input: {
  readonly snapshot: RevealOperationRecorderSnapshot;
  readonly receipts: readonly RevealContinuationReceipt[];
}): OperationEvidence["candidateOperations"] => {
  if (input.snapshot.candidateOperations.length !== input.receipts.length)
    throw new Error("Operation evidence candidate/receipt denominator drifted");
  return input.snapshot.candidateOperations.map((operation, index) => {
    const receipt = input.receipts[index];
    if (
      receipt?.candidateId !== operation.candidateId ||
      operation.candidateActionDigest !== sha256Hex(receipt.action)
    )
      throw new Error("Operation evidence candidate/receipt order drifted");
    return {
      receiptDigest: receipt.digest,
      candidateId: operation.candidateId,
      source: durableBranchProofFor(operation.source),
      preparation: operation.preparation,
      replayStepDigests: operation.replayStepDigests,
      candidateActionDigest: operation.candidateActionDigest,
      consumedLeaseId: operation.consumedLeaseId,
    };
  });
};

const inverseRestorationsFor = (input: {
  readonly snapshot: RevealOperationRecorderSnapshot;
  readonly receipts: readonly RevealContinuationReceipt[];
}): OperationEvidence["inverseRestorations"] => {
  const byCandidate = receiptByCandidateId(input.receipts);
  return input.snapshot.inverseRestorations.map((restoration) => {
    const after = byCandidate.get(restoration.afterCandidateId);
    const consumed =
      restoration.consumedByCandidateId === null
        ? undefined
        : byCandidate.get(restoration.consumedByCandidateId);
    if (after === undefined)
      throw new Error("Operation evidence restoration producer is unavailable");
    if (consumed?.sequence !== after.sequence + 1)
      throw new Error(
        "Operation evidence restoration is not consumed by the next receipt",
      );
    return {
      leaseId: restoration.leaseId,
      afterReceiptDigest: after.digest,
      inverseAction: restoration.inverseAction,
      ariaControlsTarget: restoration.ariaControlsTarget,
      source: durableBranchProofFor(restoration.source),
      terminal: durableBranchProofFor(restoration.terminal),
      restored: durableBranchProofFor(restoration.restored),
      nonMutation: restoration.nonMutation,
      consumedByReceiptDigest: consumed.digest,
    };
  });
};

const summaryFor = (input: {
  readonly candidateOperations: OperationEvidence["candidateOperations"];
  readonly inverseRestorations: OperationEvidence["inverseRestorations"];
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly predecessorActionCount: number;
}): OperationEvidence["summary"] => {
  const fullReplayActions = input.candidateOperations.reduce(
    (count, operation) => count + operation.replayStepDigests.length,
    0,
  );
  const candidateActions = input.candidateOperations.length;
  const inverseActions = input.inverseRestorations.length;
  const last = input.receipts.at(-1);
  if (last === undefined) throw new Error("Operation evidence has no receipt");
  return {
    fullReplayActions,
    candidateActions,
    inverseActions,
    successfulRestorations: inverseActions,
    consumedLeases: inverseActions,
    physicalActions: fullReplayActions + candidateActions + inverseActions,
    chargedActions: last.actionCount - input.predecessorActionCount,
  };
};

export const createRevealOperationEvidence = (input: {
  readonly run: RevealReceiptChunk["run"];
  readonly snapshot: RevealOperationRecorderSnapshot;
  readonly chunkSequence: number;
  readonly grantDigest: string;
  readonly predecessorChunkHead: string | null;
  readonly predecessorOperationDigest: string | null;
  readonly predecessorActionCount: number;
  readonly receipts: readonly RevealContinuationReceipt[];
}): OperationEvidence => {
  const candidateOperations = candidateOperationsFor(input);
  const inverseRestorations = inverseRestorationsFor(input);
  const body = {
    runDigest: sha256Hex(input.run),
    childExecutionId: input.snapshot.childExecutionId,
    childOrdinal: input.snapshot.childOrdinal,
    chunkSequence: input.chunkSequence,
    grantDigest: input.grantDigest,
    predecessorChunkHead: input.predecessorChunkHead,
    predecessorOperationDigest: input.predecessorOperationDigest,
    candidateOperations,
    inverseRestorations,
    summary: summaryFor({
      candidateOperations,
      inverseRestorations,
      receipts: input.receipts,
      predecessorActionCount: input.predecessorActionCount,
    }),
  } as const;
  if (body.summary.physicalActions > body.summary.chargedActions)
    throw new Error("Operation evidence exceeds the conservative action debit");
  const operationDigest = operationEvidenceDigestForBody(body);
  return {
    ...body,
    operationDigest,
  };
};

export const operationEvidenceBodyFor = (
  evidence: OperationEvidence,
): Omit<OperationEvidence, "operationDigest"> => {
  const { operationDigest: _operationDigest, ...body } = evidence;
  return body;
};
