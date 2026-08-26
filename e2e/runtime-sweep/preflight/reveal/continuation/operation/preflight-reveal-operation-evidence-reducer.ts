import { stableSerialize } from "../../../../support/ids.ts";
import type {
  RevealContinuationReceipt,
  RevealExecutionGrant,
  RevealReceiptChunk,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import { operationEvidenceDigestForBody } from "../preflight-reveal-continuation-digests.ts";
import type { RevealReducerInput } from "../preflight-reveal-continuation-reducer.ts";
import { operationEvidenceBodyFor } from "./preflight-reveal-operation-evidence.ts";
import { assertCandidateOperations } from "./preflight-reveal-operation-evidence-reducer-candidates.ts";
import { assertInverseRestorations } from "./preflight-reveal-operation-evidence-reducer-restoration.ts";

type OperationEvidence = RevealReceiptChunk["operationEvidence"];
export type RevealOperationTotals =
  RevealExecutionGrant["chain"]["operationTotals"];

export const zeroRevealOperationTotals = (): RevealOperationTotals => ({
  fullReplayActions: 0,
  candidateActions: 0,
  inverseActions: 0,
  successfulRestorations: 0,
  consumedLeases: 0,
  physicalActions: 0,
  chargedActions: 0,
});

export const addRevealOperationTotals = (
  left: RevealOperationTotals,
  right: RevealOperationTotals,
): RevealOperationTotals => ({
  fullReplayActions: left.fullReplayActions + right.fullReplayActions,
  candidateActions: left.candidateActions + right.candidateActions,
  inverseActions: left.inverseActions + right.inverseActions,
  successfulRestorations:
    left.successfulRestorations + right.successfulRestorations,
  consumedLeases: left.consumedLeases + right.consumedLeases,
  physicalActions: left.physicalActions + right.physicalActions,
  chargedActions: left.chargedActions + right.chargedActions,
});

export const expectedRowLocalCohortOperationTotals = (
  toggleCount: number,
): Readonly<{
  readonly root: RevealOperationTotals;
  readonly directedPairs: RevealOperationTotals;
  readonly cohort: RevealOperationTotals;
}> => {
  if (!Number.isSafeInteger(toggleCount) || toggleCount < 2)
    throw new Error("Row-local cohort requires at least two toggles");
  const directedPairCandidates = toggleCount * (toggleCount - 1);
  const inverseActions = toggleCount * (toggleCount - 2);
  const directedPairActions = directedPairCandidates * 2;
  const root: RevealOperationTotals = {
    ...zeroRevealOperationTotals(),
    candidateActions: toggleCount,
    physicalActions: toggleCount,
    chargedActions: toggleCount,
  };
  const directedPairs: RevealOperationTotals = {
    fullReplayActions: toggleCount,
    candidateActions: directedPairCandidates,
    inverseActions,
    successfulRestorations: inverseActions,
    consumedLeases: inverseActions,
    physicalActions: directedPairActions,
    chargedActions: directedPairActions,
  };
  return {
    root,
    directedPairs,
    cohort: addRevealOperationTotals(root, directedPairs),
  };
};

const derivedTotalsFor = (input: {
  readonly evidence: OperationEvidence;
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly predecessorActionCount: number;
}): RevealOperationTotals => {
  const last = input.receipts.at(-1);
  if (last === undefined)
    throw new Error("R188 operation evidence has no receipt");
  const fullReplayActions = input.evidence.candidateOperations.reduce(
    (count, operation) => count + operation.replayStepDigests.length,
    0,
  );
  const candidateActions = input.receipts.length;
  const inverseActions = input.evidence.inverseRestorations.length;
  const chargedActions = last.actionCount - input.predecessorActionCount;
  if (chargedActions < 0)
    throw new Error("R188 operation action debit moved backwards");
  return {
    fullReplayActions,
    candidateActions,
    inverseActions,
    successfulRestorations: inverseActions,
    consumedLeases: inverseActions,
    physicalActions: fullReplayActions + candidateActions + inverseActions,
    chargedActions,
  };
};

export const reduceRevealOperationEvidence = (input: {
  readonly queueInput: RevealReducerInput;
  readonly chunk: RevealReceiptChunk;
  readonly expectedChildExecutionId: string;
  readonly expectedChildOrdinal: number;
  readonly expectedRunDigest: string;
  readonly expectedGrantDigest: string;
  readonly predecessorOperationDigest: string | null;
  readonly predecessorActionCount: number;
}): Readonly<{
  readonly operationDigest: string;
  readonly totals: RevealOperationTotals;
}> => {
  const evidence = input.chunk.operationEvidence;
  if (
    evidence.operationDigest !==
      operationEvidenceDigestForBody(operationEvidenceBodyFor(evidence)) ||
    evidence.runDigest !== input.expectedRunDigest ||
    evidence.childExecutionId !== input.expectedChildExecutionId ||
    evidence.childOrdinal !== input.expectedChildOrdinal ||
    evidence.chunkSequence !== input.chunk.chunkSequence ||
    evidence.grantDigest !== input.expectedGrantDigest ||
    evidence.predecessorChunkHead !== input.chunk.predecessorChunkHead ||
    evidence.predecessorOperationDigest !== input.predecessorOperationDigest
  )
    throw new Error("R188 operation evidence scope or digest drifted");
  assertCandidateOperations({
    queueInput: input.queueInput,
    evidence,
    receipts: input.chunk.receipts,
  });
  assertInverseRestorations({
    queueInput: input.queueInput,
    evidence,
    receipts: input.chunk.receipts,
  });
  const totals = derivedTotalsFor({
    evidence,
    receipts: input.chunk.receipts,
    predecessorActionCount: input.predecessorActionCount,
  });
  if (
    stableSerialize(totals) !== stableSerialize(evidence.summary) ||
    totals.physicalActions > totals.chargedActions
  )
    throw new Error(
      "R188 operation totals exceed or drift from the parent debit",
    );
  return { operationDigest: evidence.operationDigest, totals };
};
