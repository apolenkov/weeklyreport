import type {
  RevealContinuationReceipt,
  RevealExecutionGrant,
} from "./contracts/preflight-reveal-continuation-schemas.ts";

export interface RevealContinuationProgress {
  readonly receipts: RevealContinuationReceipt[];
  completedCandidateCount: number;
}

export const revealContinuationProgressFor = (
  grant: RevealExecutionGrant | undefined,
): RevealContinuationProgress => ({
  completedCandidateCount: grant?.frontier.completedCandidateCount ?? 0,
  receipts: [],
});
