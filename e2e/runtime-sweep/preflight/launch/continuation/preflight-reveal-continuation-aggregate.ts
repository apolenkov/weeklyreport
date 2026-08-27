import * as path from "node:path";

import { assertLivePreflightSourceIdentity } from "../../canary/preflight-canary.ts";
import { writeRevealContinuationJson } from "../../reveal/continuation/preflight-reveal-continuation-io.ts";
import {
  type RevealPartitionExecutionResult,
  runChildUntilPartitionBoundary,
} from "../checkpoint/preflight-reveal-host-checkpoint-partition.ts";
import { aggregatePartitionContextFor } from "./preflight-reveal-continuation-aggregate-deadline.ts";
import { aggregatePartitionPlanForContext } from "./preflight-reveal-continuation-aggregate-plan.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";
import { runContinuationChild } from "./preflight-reveal-continuation-parent-child.ts";
import { initialParentProgress } from "./preflight-reveal-continuation-parent-progress.ts";
import {
  assertRevealAggregateComplete,
  createRevealAggregateCompletion,
  createRevealPartitionReceipt,
  emptyRevealAggregatePartitionState,
  parseRevealAggregateCompletion,
  parseRevealPartitionPlan,
  reduceRevealPartitionReceipt,
  type RevealAggregatePartitionState,
  type RevealPartitionChain,
  type RevealPartitionPlan,
  revealPartitionReceiptSchema,
} from "./preflight-reveal-continuation-partition.ts";

const partitionPlanPathFor = (context: ParentContext): string =>
  path.join(
    context.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_AGGREGATE_PARTITION_PLAN.${context.attemptId}.json`,
  );

const partitionReceiptPathFor = (
  context: ParentContext,
  partitionId: string,
): string =>
  path.join(
    context.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_AGGREGATE_PARTITION_RECEIPT.${context.attemptId}.${partitionId}.json`,
  );

const aggregateCompletionPathFor = (context: ParentContext): string =>
  path.join(
    context.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE.${context.attemptId}.json`,
  );

const assertPlanMatchesContext = (input: {
  readonly context: ParentContext;
  readonly plan: RevealPartitionPlan;
}): void => {
  const expected = aggregatePartitionPlanForContext({
    context: input.context,
    partitionCandidateLimit: input.plan.partitionCandidateLimit,
    partitionMaxMs: input.plan.partitionMaxMs,
    teardownReserveMs: input.plan.teardownReserveMs,
  });
  if (expected.partitionPlanDigest !== input.plan.partitionPlanDigest)
    throw new Error(
      "Aggregate partition plan is not bound to the parent context",
    );
};

export const writeAggregatePartitionPlan = async (input: {
  readonly context: ParentContext;
  readonly plan: RevealPartitionPlan;
}): Promise<void> =>
  writeRevealContinuationJson({
    archiveRoot: input.context.archiveRoot,
    filePath: partitionPlanPathFor(input.context),
    value: input.plan,
    parse: (value) => parseRevealPartitionPlan(value),
  });

const writeReceipt = async (input: {
  readonly context: ParentContext;
  readonly receipt: ReturnType<typeof createRevealPartitionReceipt>;
}): Promise<void> =>
  writeRevealContinuationJson({
    archiveRoot: input.context.archiveRoot,
    filePath: partitionReceiptPathFor(input.context, input.receipt.partitionId),
    value: input.receipt,
    parse: (value) => revealPartitionReceiptSchema.parse(value),
  });

const writeCompletion = async (input: {
  readonly context: ParentContext;
  readonly completion: ReturnType<typeof createRevealAggregateCompletion>;
}): Promise<void> =>
  writeRevealContinuationJson({
    archiveRoot: input.context.archiveRoot,
    filePath: aggregateCompletionPathFor(input.context),
    value: input.completion,
    parse: (value) => parseRevealAggregateCompletion(value),
  });

const terminalPublicationFor = (
  result: RevealPartitionExecutionResult,
): (() => Promise<number>) | undefined => result.terminalPublication;

const chainForProgress = (progress: ParentProgress): RevealPartitionChain => ({
  receiptHead: progress.receiptHead,
  receiptCount: progress.receiptCount,
  chunkHead: progress.chunkHead,
  chunkCount: progress.chunkCount,
  operationHead: progress.operationHead,
  operationChunkCount: progress.operationChunkCount,
  operationTotals: progress.operationTotals,
});

type AggregateStepInput = Readonly<{
  readonly context: ParentContext;
  readonly plan: RevealPartitionPlan;
  readonly partitionIndex: number;
  readonly partitionMaxMs: number;
  readonly progress: ParentProgress;
  readonly aggregateState: RevealAggregatePartitionState;
  readonly receiptDigests: readonly string[];
  readonly ordinal: number;
  readonly maxChildren: number;
  readonly runChild?: typeof runContinuationChild;
}>;

const executeAggregatePartition = async (
  input: AggregateStepInput,
): Promise<RevealPartitionExecutionResult> => {
  const partitionContext = aggregatePartitionContextFor({
    context: input.context,
    partitionMaxMs: input.partitionMaxMs,
    teardownReserveMs: input.plan.teardownReserveMs,
  });
  await assertLivePreflightSourceIdentity({
    source: partitionContext.source,
    repoRoot: partitionContext.repoRoot,
  });
  return runChildUntilPartitionBoundary({
    context: partitionContext,
    progress: input.progress,
    ordinal: input.ordinal,
    maxChildren: input.maxChildren,
    partitionStartCandidateCount: input.aggregateState.completedCandidateCount,
    partitionCandidateLimit: input.plan.partitionCandidateLimit,
    ...(input.runChild === undefined ? {} : { runChild: input.runChild }),
  });
};

const persistAggregatePartition = async (input: {
  readonly step: AggregateStepInput;
  readonly result: RevealPartitionExecutionResult;
}): Promise<
  Readonly<{
    readonly aggregateState: RevealAggregatePartitionState;
    readonly receiptDigests: readonly string[];
  }>
> => {
  const { step, result } = input;
  const receipt = createRevealPartitionReceipt({
    plan: step.plan,
    state: step.aggregateState,
    partitionIndex: step.partitionIndex,
    attemptId: step.context.attemptId,
    authorityKey: step.context.authorityKey,
    startChildOrdinal: step.aggregateState.nextChildOrdinal,
    endChildOrdinal: result.completedChildOrdinal,
    endCandidateCount: result.progress.previousCompletedCandidateCount,
    startCheckpointDigest: step.aggregateState.checkpointDigest,
    endCheckpointDigest: result.progress.previousCheckpointDigest ?? "",
    startSampleSequence: step.aggregateState.sampleSequence,
    endSampleSequence: result.progress.previousSampleSequence ?? -1,
    startGrantDigest: step.aggregateState.grantDigest,
    endGrantDigest: result.progress.previousGrantDigest,
    frontier: result.status === "COMPLETE" ? "empty" : "non-empty",
    cleanupEvidence: result.cleanupEvidence,
    endChain: chainForProgress(result.progress),
  });
  await writeReceipt({ context: step.context, receipt });
  return {
    aggregateState: reduceRevealPartitionReceipt({
      plan: step.plan,
      state: step.aggregateState,
      receipt,
      authorityKey: step.context.authorityKey,
    }),
    receiptDigests: [...step.receiptDigests, receipt.partitionReceiptDigest],
  };
};

const runAggregateStep = async (input: AggregateStepInput): Promise<number> => {
  if (input.aggregateState.status === "COMPLETE")
    throw new Error("Aggregate partition runner received a terminal state");
  const result = await executeAggregatePartition(input);
  if (result.exitCode !== 0) return result.exitCode;
  const persisted = await persistAggregatePartition({ step: input, result });
  if (result.status === "COMPLETE") {
    assertRevealAggregateComplete({
      plan: input.plan,
      state: persisted.aggregateState,
    });
    const completion = createRevealAggregateCompletion({
      plan: input.plan,
      state: persisted.aggregateState,
      partitionReceiptDigests: persisted.receiptDigests,
    });
    await input.context.beforeAggregateTerminalPublication?.();
    // Persist the aggregate proof before the terminal publisher can emit the
    // canonical PASS. A publication failure then leaves no PASS without its
    // required completion artifact.
    await writeCompletion({ context: input.context, completion });
    const terminalPublication = terminalPublicationFor(result);
    if (terminalPublication === undefined)
      throw new Error("Aggregate terminal result has no parent publication");
    const terminalCode = await terminalPublication();
    if (terminalCode !== 0)
      throw new Error(
        `Aggregate terminal publication exited with code ${String(terminalCode)}`,
      );
    return terminalCode;
  }
  if (input.partitionIndex === input.plan.maxPartitions - 1)
    throw new Error(
      "Aggregate partition plan exhausted while the reveal frontier remained non-empty",
    );
  return runAggregateStep({
    ...input,
    partitionIndex: input.partitionIndex + 1,
    aggregateState: persisted.aggregateState,
    receiptDigests: persisted.receiptDigests,
    progress: result.progress,
    ordinal: result.nextOrdinal,
  });
};

export const runRevealContinuationWithAggregatePartitions = async (input: {
  readonly context: ParentContext;
  readonly plan?: RevealPartitionPlan;
  readonly maxChildren: number;
  readonly partitionMaxMs?: number;
  readonly runChild?: typeof runContinuationChild;
}): Promise<number> => {
  if (input.context.beforeAggregateTerminalPublication === undefined)
    throw new Error(
      "Aggregate partition continuation requires terminal cleanup preparation",
    );
  const plan =
    input.plan ?? aggregatePartitionPlanForContext({ context: input.context });
  parseRevealPartitionPlan(plan);
  assertPlanMatchesContext({ context: input.context, plan });
  const partitionMaxMs = input.partitionMaxMs ?? plan.partitionMaxMs;
  if (partitionMaxMs !== plan.partitionMaxMs)
    throw new Error(
      "Aggregate partition functional budget is not bound to the plan",
    );
  await writeAggregatePartitionPlan({ context: input.context, plan });
  return runAggregateStep({
    context: input.context,
    plan,
    partitionIndex: 0,
    partitionMaxMs,
    progress: initialParentProgress(),
    aggregateState: emptyRevealAggregatePartitionState(),
    receiptDigests: [],
    ordinal: 0,
    maxChildren: input.maxChildren,
    ...(input.runChild === undefined ? {} : { runChild: input.runChild }),
  });
};

export { aggregatePartitionDeadlinesFor } from "./preflight-reveal-continuation-aggregate-deadline.ts";
export {
  aggregatePartitionAttemptMaxMsFor,
  aggregatePartitionPlanForContext,
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CANDIDATE_LIMIT,
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_MAX_MS,
  PREFLIGHT_REVEAL_AGGREGATE_TEARDOWN_RESERVE_MS,
} from "./preflight-reveal-continuation-aggregate-plan.ts";
