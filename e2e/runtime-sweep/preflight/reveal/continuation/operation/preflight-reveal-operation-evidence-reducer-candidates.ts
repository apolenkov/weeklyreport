import { sha256Hex, stableSerialize } from "../../../../support/ids.ts";
import type {
  RevealContinuationReceipt,
  RevealReceiptChunk,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import { serializableInventoryFor } from "../preflight-reveal-continuation-inventory.ts";
import type { RevealReducerInput } from "../preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "../receipts/preflight-reveal-continuation-receipts.ts";

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

export const assertCandidateOperations = (input: {
  readonly queueInput: RevealReducerInput;
  readonly evidence: OperationEvidence;
  readonly receipts: readonly RevealContinuationReceipt[];
}): void => {
  if (input.evidence.candidateOperations.length !== input.receipts.length)
    throw new Error("R188 operation candidate denominator drifted");
  for (const [index, receipt] of input.receipts.entries()) {
    const operation = input.evidence.candidateOperations[index];
    if (
      operation?.receiptDigest !== receipt.digest ||
      operation.candidateId !== receipt.candidateId ||
      operation.candidateActionDigest !== sha256Hex(receipt.action)
    )
      throw new Error("R188 operation candidate/receipt binding drifted");
    const branch = branchForRef(receipt.branchRef);
    assertBranchProof({ actual: operation.source, branch, label: "candidate" });
    const expectedReplay = branch.path.steps.map((step) => sha256Hex(step));
    if (operation.preparation === "FULL_REPLAY") {
      if (
        operation.consumedLeaseId !== null ||
        stableSerialize(operation.replayStepDigests) !==
          stableSerialize(expectedReplay)
      )
        throw new Error("R188 full-replay operation evidence drifted");
    } else if (
      operation.consumedLeaseId === null ||
      operation.replayStepDigests.length > 0
    ) {
      throw new Error("R188 inverse-lease operation evidence drifted");
    }
  }
};
