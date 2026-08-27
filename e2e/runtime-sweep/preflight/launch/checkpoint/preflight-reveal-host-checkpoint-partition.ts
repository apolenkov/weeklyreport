import { assertLivePreflightSourceIdentity } from "../../canary/preflight-canary.ts";
import type {
  ParentContext,
  ParentProgress,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import {
  assertRevealContinuationActive,
  assertRevealContinuationTerminalPublicationActive,
  remainingRevealContinuationMs,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import { runContinuationChild } from "../continuation/preflight-reveal-continuation-parent-child.ts";
import type { RevealPartitionCleanupEvidence } from "../continuation/preflight-reveal-continuation-partition-contract.ts";
import { preflightPlaywrightChildCleanupWithOrdinalFor } from "../preflight-playwright-child-cleanup.ts";
import { runRevealContinuationChildWithBudget } from "./budget/preflight-reveal-host-checkpoint-budget-runner.ts";
import {
  type PreparedTerminalChildPublication,
  prepareTerminalChildPublication,
  requestHostCheckpointAfterChild,
} from "./preflight-reveal-host-checkpoint-parent.ts";

export type RevealPartitionExecutionResult = Readonly<{
  readonly status: "BOUNDARY" | "COMPLETE";
  readonly progress: ParentProgress;
  readonly startChildOrdinal: number;
  readonly nextOrdinal: number;
  readonly completedChildOrdinal: number;
  readonly exitCode: number;
  readonly cleanupEvidence: readonly PartitionCleanupEvidence[];
  readonly terminalPublication?: PreparedTerminalChildPublication["publishTerminalArtifacts"];
}>;

type PartitionCleanupEvidence = RevealPartitionCleanupEvidence;
type PartitionOutcomeInput = Pick<
  RevealPartitionExecutionResult,
  "progress" | "startChildOrdinal" | "cleanupEvidence"
> & { readonly ordinal: number };
type PartitionChildResult = Readonly<{
  readonly result: Awaited<ReturnType<typeof runContinuationChild>> | undefined;
  readonly cleanupEvidence: readonly PartitionCleanupEvidence[];
  readonly budgetExhaustedBeforeLaunch: boolean;
}>;

const assertPartitionCleanupEvidence = (input: {
  readonly evidence: readonly RevealPartitionCleanupEvidence[];
  readonly startChildOrdinal: number;
  readonly completedChildOrdinal: number;
}): void => {
  if (
    input.evidence.length !==
    input.completedChildOrdinal - input.startChildOrdinal + 1
  )
    throw new Error(
      "Reveal aggregate partition cleanup evidence does not cover every child",
    );
  input.evidence.forEach((evidence, index) => {
    if (
      evidence.childOrdinal !== input.startChildOrdinal + index ||
      evidence.pid < 1 ||
      evidence.pgid !== evidence.pid
    )
      throw new Error(
        "Reveal aggregate partition cleanup evidence is not terminal and owned",
      );
  });
};

const assertPartitionInput = (input: {
  readonly progress: ParentProgress;
  readonly partitionStartCandidateCount: number;
  readonly partitionCandidateLimit: number;
}): void => {
  if (
    !Number.isSafeInteger(input.partitionCandidateLimit) ||
    input.partitionCandidateLimit < 1
  )
    throw new Error(
      "Reveal aggregate partition limit must be a safe positive integer",
    );
  if (
    !Number.isSafeInteger(input.partitionStartCandidateCount) ||
    input.partitionStartCandidateCount < 0
  )
    throw new Error("Reveal aggregate partition start count is invalid");
  if (
    input.progress.previousCompletedCandidateCount !==
    input.partitionStartCandidateCount
  )
    throw new Error(
      "Reveal aggregate partition start does not match parent progress",
    );
};

const runPartitionChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly startChildOrdinal: number;
  readonly ordinal: number;
  readonly runChild: typeof runContinuationChild;
}): Promise<PartitionChildResult> => {
  const cleanupEvidence: PartitionCleanupEvidence[] = [];
  const budgetBoundary = { value: false };
  const context: ParentContext = {
    ...input.context,
    onChildCleanup: (evidence) => {
      input.context.onChildCleanup?.(evidence);
      cleanupEvidence.push(
        preflightPlaywrightChildCleanupWithOrdinalFor(evidence),
      );
    },
  };
  await assertLivePreflightSourceIdentity({
    source: context.source,
    repoRoot: context.repoRoot,
  });
  const result = await runRevealContinuationChildWithBudget({
    context,
    progress: input.progress,
    ordinal: input.ordinal,
    runChild: input.runChild,
    remainingMs: remainingRevealContinuationMs(context),
    assertTerminalPublicationActive: () =>
      assertRevealContinuationTerminalPublicationActive(context),
    ...(input.ordinal > input.startChildOrdinal
      ? {
          onPrelaunchBudgetExhausted: () => {
            budgetBoundary.value = true;
          },
        }
      : {}),
  });
  return {
    result,
    cleanupEvidence,
    budgetExhaustedBeforeLaunch: budgetBoundary.value,
  };
};

const checkpointProgress = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
}): Promise<ParentProgress> => {
  if (input.context.requestHostCheckpoint === undefined)
    throw new Error(
      "Reveal aggregate continuation requires a parent-only host checkpoint client",
    );
  const checkpoint = await requestHostCheckpointAfterChild(input);
  return {
    ...input.progress,
    previousCheckpointDigest: checkpoint.responseDigest,
    previousSampleSequence: checkpoint.sample.eventSequence,
  };
};

const prepareCompletedChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly startChildOrdinal: number;
  readonly ordinal: number;
  readonly result: Exclude<
    Awaited<ReturnType<typeof runContinuationChild>>,
    undefined
  >;
  readonly cleanupEvidence: readonly PartitionCleanupEvidence[];
}): Promise<RevealPartitionExecutionResult> => {
  const prepared = await prepareTerminalChildPublication({
    context: input.context,
    progress: input.result.progress,
    ordinal: input.ordinal,
    exitCode: input.result.exitCode ?? 0,
    ...(input.result.publishTerminalArtifacts === undefined
      ? {}
      : { publishTerminalArtifacts: input.result.publishTerminalArtifacts }),
  });
  return {
    status: "COMPLETE",
    progress: prepared.progress,
    startChildOrdinal: input.startChildOrdinal,
    nextOrdinal: input.ordinal,
    completedChildOrdinal: input.ordinal,
    exitCode: prepared.exitCode,
    cleanupEvidence: input.cleanupEvidence,
    ...(prepared.publishTerminalArtifacts === undefined
      ? {}
      : { terminalPublication: prepared.publishTerminalArtifacts }),
  };
};

const budgetBoundaryResultFor = (
  input: PartitionOutcomeInput,
): RevealPartitionExecutionResult => {
  if (input.ordinal <= input.startChildOrdinal)
    throw new Error(
      "Aggregate partition budget boundary requires a completed child",
    );
  return {
    status: "BOUNDARY",
    progress: input.progress,
    startChildOrdinal: input.startChildOrdinal,
    nextOrdinal: input.ordinal,
    completedChildOrdinal: input.ordinal - 1,
    exitCode: 0,
    cleanupEvidence: input.cleanupEvidence,
  };
};

const failedPartitionResultFor = (
  input: PartitionOutcomeInput,
): RevealPartitionExecutionResult => ({
  status: "COMPLETE",
  progress: input.progress,
  startChildOrdinal: input.startChildOrdinal,
  nextOrdinal: input.ordinal,
  completedChildOrdinal: input.ordinal,
  exitCode: 1,
  cleanupEvidence: input.cleanupEvidence,
});

const runPartitionStep = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly startChildOrdinal: number;
  readonly ordinal: number;
  readonly maxChildren: number;
  readonly partitionStartCandidateCount: number;
  readonly partitionCandidateLimit: number;
  readonly runChild: typeof runContinuationChild;
  readonly cleanupEvidence: readonly PartitionCleanupEvidence[];
}): Promise<RevealPartitionExecutionResult> => {
  assertRevealContinuationActive(input.context);
  if (input.ordinal >= input.maxChildren)
    throw new Error(
      `Reveal aggregate continuation exceeded its source-derived child guard of ${String(input.maxChildren)}`,
    );
  const child = await runPartitionChild(input);
  const cleanupEvidence = [...input.cleanupEvidence, ...child.cleanupEvidence];
  if (child.result === undefined && child.budgetExhaustedBeforeLaunch) {
    return budgetBoundaryResultFor({
      progress: input.progress,
      startChildOrdinal: input.startChildOrdinal,
      ordinal: input.ordinal,
      cleanupEvidence,
    });
  }
  if (child.result === undefined)
    return failedPartitionResultFor({
      progress: input.progress,
      startChildOrdinal: input.startChildOrdinal,
      ordinal: input.ordinal,
      cleanupEvidence,
    });
  if (child.result.done)
    return prepareCompletedChild({
      context: input.context,
      progress: input.progress,
      startChildOrdinal: input.startChildOrdinal,
      ordinal: input.ordinal,
      result: child.result,
      cleanupEvidence,
    });
  const progress = await checkpointProgress({
    context: input.context,
    progress: child.result.progress,
    ordinal: input.ordinal,
  });
  if (
    progress.previousCompletedCandidateCount -
      input.partitionStartCandidateCount >=
    input.partitionCandidateLimit
  )
    return {
      status: "BOUNDARY",
      progress,
      startChildOrdinal: input.startChildOrdinal,
      nextOrdinal: input.ordinal + 1,
      completedChildOrdinal: input.ordinal,
      exitCode: 0,
      cleanupEvidence,
    };
  return runPartitionStep({
    ...input,
    progress,
    ordinal: input.ordinal + 1,
    cleanupEvidence,
  });
};

/** Run children until a source-bound aggregate partition boundary or completion. */
export const runChildUntilPartitionBoundary = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly maxChildren: number;
  readonly partitionStartCandidateCount: number;
  readonly partitionCandidateLimit: number;
  readonly runChild?: typeof runContinuationChild;
}): Promise<RevealPartitionExecutionResult> => {
  assertPartitionInput(input);
  const result = await runPartitionStep({
    ...input,
    startChildOrdinal: input.ordinal,
    runChild: input.runChild ?? runContinuationChild,
    cleanupEvidence: [],
  });
  if (result.exitCode === 0)
    assertPartitionCleanupEvidence({
      evidence: result.cleanupEvidence,
      startChildOrdinal: result.startChildOrdinal,
      completedChildOrdinal: result.completedChildOrdinal,
    });
  return result;
};
