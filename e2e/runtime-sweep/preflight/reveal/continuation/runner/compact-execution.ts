import { sameRevealSurfaceMaterial } from "../../guards/reveal-surface-material.ts";
import {
  createRevealOperationRecorder,
  type RevealOperationRecorder,
} from "../../interaction/evidence/preflight-reveal-operation-recorder.ts";
import { branchFor } from "../../interaction/preflight-reveal-branch-execution.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealQueueInput,
} from "../../interaction/preflight-reveal-branches.ts";
import { RevealDiscoveryError } from "../../interaction/preflight-reveal-types.ts";
import { REVEAL_CONTINUATION_LIMITS } from "../contracts/preflight-reveal-continuation-limits.ts";
import type {
  RevealContinuationReceipt,
  RevealExecutionGrant,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import type {
  RevealContinuationChunkResult,
  RevealContinuationInput,
} from "../preflight-reveal-continuation-runner.ts";
import { chunkFor } from "../preflight-reveal-continuation-runner-execution.ts";
import { writeReceiptAssets } from "../preflight-reveal-continuation-runner-output.ts";
import { receiptForTerminal } from "../receipts/preflight-reveal-continuation-receipts.ts";

type CompactCursor = Readonly<{
  readonly candidateIndex: number;
  readonly actionCount: number;
  readonly branchCount: number;
  readonly completedCandidateCount: number;
  readonly receipts: readonly RevealContinuationReceipt[];
}>;

const compactTerminalFor = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly operationRecorder: RevealOperationRecorder;
  readonly branch: RevealBranch;
  readonly candidate: RevealCandidate;
  readonly candidateIndex: number;
}) => {
  const result = await branchFor({
    harness: input.queueInput.harness,
    state: input.queueInput.state,
    route: input.queueInput.route,
    initialSurface: input.queueInput.initialSurface,
    operationRecorder: input.operationRecorder,
    branch: input.branch,
    candidate: input.candidate,
  });
  const materialChanged =
    result.explore &&
    !(
      sameRevealSurfaceMaterial(input.branch.surface, result.branch.surface) &&
      input.branch.url === result.branch.url
    );
  return {
    candidate: input.candidate,
    result,
    candidateIndex: input.candidateIndex,
    materialChanged,
  } as const;
};

const requiredCandidate = (
  candidates: readonly RevealCandidate[],
  index: number,
): RevealCandidate => {
  const candidate = candidates[index];
  if (candidate !== undefined) return candidate;
  throw new RevealDiscoveryError(
    `Reveal candidate ${String(index)} is missing from its ordered list`,
  );
};

const processCompactCandidates = async (input: {
  readonly continuation: RevealContinuationInput;
  readonly queueInput: RevealQueueInput;
  readonly grant: RevealExecutionGrant;
  readonly branch: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly operationRecorder: RevealOperationRecorder;
  readonly startingActionCount: number;
  readonly deadlineAt: number;
  readonly now: () => number;
  readonly cursor: CompactCursor;
}): Promise<CompactCursor> => {
  const limits =
    input.continuation.cooperativeLimits ?? REVEAL_CONTINUATION_LIMITS;
  if (
    input.cursor.candidateIndex >= input.candidates.length ||
    input.cursor.receipts.length >= limits.maxTerminalCandidates ||
    input.cursor.actionCount - input.startingActionCount >=
      limits.maxRevealActionDelta ||
    input.now() >= input.deadlineAt
  )
    return input.cursor;
  const candidate = requiredCandidate(
    input.candidates,
    input.cursor.candidateIndex,
  );
  const actionCount =
    input.cursor.actionCount + input.branch.path.steps.length + 1;
  if (actionCount > input.queueInput.maxRevealActions)
    throw new RevealDiscoveryError("Reveal action bound exceeded");
  const terminal = await compactTerminalFor({
    queueInput: input.queueInput,
    operationRecorder: input.operationRecorder,
    branch: input.branch,
    candidate,
    candidateIndex: input.cursor.candidateIndex,
  });
  const branchCount =
    input.cursor.branchCount + (terminal.materialChanged ? 1 : 0);
  if (branchCount > input.queueInput.maxRevealMaterialEdges)
    throw new RevealDiscoveryError("Reveal material edge bound exceeded");
  const completedCandidateCount = input.cursor.completedCandidateCount + 1;
  const receipt = receiptForTerminal({
    terminal,
    branch: input.branch,
    candidates: input.candidates,
    sequence: completedCandidateCount,
    predecessorDigest:
      input.cursor.receipts.at(-1)?.digest ?? input.grant.chain.receiptHead,
    completedCandidateCount,
    actionCount,
    branchCount,
  });
  return processCompactCandidates({
    ...input,
    cursor: {
      candidateIndex: input.cursor.candidateIndex + 1,
      actionCount,
      branchCount,
      completedCandidateCount,
      receipts: [...input.cursor.receipts, receipt],
    },
  });
};

export const executeCompactRevealContinuationChunk = async (input: {
  readonly input: RevealContinuationInput;
  readonly queueInput: RevealQueueInput;
  readonly grant: RevealExecutionGrant;
  readonly branch: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly deadlineAt: number;
  readonly now: () => number;
}): Promise<RevealContinuationChunkResult> => {
  const startingActionCount = input.grant.frontier.actionCount;
  const operationRecorder = createRevealOperationRecorder({
    childExecutionId: input.input.childExecutionId,
    childOrdinal: input.input.childOrdinal,
  });
  const cursor = await processCompactCandidates({
    continuation: input.input,
    queueInput: input.queueInput,
    grant: input.grant,
    branch: input.branch,
    candidates: input.candidates,
    operationRecorder,
    startingActionCount,
    deadlineAt: input.deadlineAt,
    now: input.now,
    cursor: {
      candidateIndex: input.nextCandidateIndex,
      actionCount: startingActionCount,
      branchCount: input.grant.frontier.branchCount,
      completedCandidateCount: input.grant.frontier.completedCandidateCount,
      receipts: [],
    },
  });
  if (cursor.receipts.length === 0)
    throw new Error(
      "Reveal continuation child reached a receipt-free non-bootstrap boundary",
    );
  const progress = {
    receipts: [...cursor.receipts],
    completedCandidateCount: cursor.completedCandidateCount,
  };
  const chunk = chunkFor({
    input: input.input,
    grant: input.grant,
    result: { completed: false },
    progress,
    operationRecorder,
    startingActionCount,
  });
  await writeReceiptAssets({
    archiveRoot: input.input.archiveRoot,
    receipts: progress.receipts,
  });
  return {
    status: "CHUNK",
    chunk,
    completed: false,
    completedCandidateCount: progress.completedCandidateCount,
  };
};
