import { combineFailures } from "../bounded/preflight-detached-process-group.ts";
import { runChildUntilDone } from "../checkpoint/preflight-reveal-host-checkpoint-parent.ts";
import {
  runRevealContinuationWithAggregatePartitions,
  writeAggregatePartitionPlan,
} from "./preflight-reveal-continuation-aggregate.ts";
import type { ParentContext } from "./preflight-reveal-continuation-parent.ts";
import { initialParentProgress } from "./preflight-reveal-continuation-parent-progress.ts";
import type { RevealPartitionPlan } from "./preflight-reveal-continuation-partition.ts";

export { initialParentProgress } from "./preflight-reveal-continuation-parent-progress.ts";

const runChildrenForInput = (input: {
  readonly context: ParentContext;
  readonly maxChildren: number;
  readonly runChildren?: typeof runChildUntilDone;
  readonly aggregatePlan?: RevealPartitionPlan;
  readonly runAggregatePartitions?: typeof runRevealContinuationWithAggregatePartitions;
  readonly aggregatePartitionMaxMs?: number;
}): Promise<number> => {
  if (input.aggregatePlan !== undefined)
    return (
      input.runAggregatePartitions ??
      runRevealContinuationWithAggregatePartitions
    )({
      context: input.context,
      plan: input.aggregatePlan,
      maxChildren: input.maxChildren,
      ...(input.aggregatePartitionMaxMs === undefined
        ? {}
        : { partitionMaxMs: input.aggregatePartitionMaxMs }),
    });
  return (input.runChildren ?? runChildUntilDone)({
    context: input.context,
    progress: initialParentProgress(),
    ordinal: 0,
    maxChildren: input.maxChildren,
  });
};

interface RevealRuntimeInput {
  readonly context: ParentContext;
  readonly maxChildren: number;
  readonly runChildren?: typeof runChildUntilDone;
  readonly aggregatePlan?: RevealPartitionPlan;
  readonly runAggregatePartitions?: typeof runRevealContinuationWithAggregatePartitions;
  readonly aggregatePartitionMaxMs?: number;
  readonly beforeRun?: (context: ParentContext) => Promise<void>;
  readonly afterRun?: (context: ParentContext) => Promise<void>;
}

interface RevealRuntimeState {
  primary?: unknown;
  afterRunAttempted: boolean;
}

const runtimeContextFor = (
  input: RevealRuntimeInput,
  state: RevealRuntimeState,
): ParentContext => {
  const afterRun = input.afterRun;
  if (input.aggregatePlan === undefined || afterRun === undefined)
    return input.context;
  const runtimeContext: ParentContext = {
    ...input.context,
    beforeAggregateTerminalPublication: async () => {
      await input.context.beforeAggregateTerminalPublication?.();
      state.afterRunAttempted = true;
      await afterRun(runtimeContext);
    },
  };
  return runtimeContext;
};

const writeAggregatePlanIfPresent = async (
  input: RevealRuntimeInput,
): Promise<void> => {
  if (input.aggregatePlan === undefined) return;
  await writeAggregatePartitionPlan({
    context: input.context,
    plan: input.aggregatePlan,
  });
};

const cleanupRuntime = async (input: {
  readonly afterRun?: (context: ParentContext) => Promise<void>;
  readonly context: ParentContext;
  readonly state: RevealRuntimeState;
}): Promise<void> => {
  const afterRun = input.afterRun;
  if (afterRun === undefined || input.state.afterRunAttempted) return;
  try {
    input.state.afterRunAttempted = true;
    await afterRun(input.context);
  } catch (cleanupError: unknown) {
    if (input.state.primary !== undefined)
      throw combineFailures(
        "Reveal continuation runtime",
        input.state.primary,
        [cleanupError],
      );
    throw cleanupError;
  }
};

export const runRevealContinuationWithRuntime = async (
  input: RevealRuntimeInput,
): Promise<number> => {
  const state: { primary?: unknown; afterRunAttempted: boolean } = {
    afterRunAttempted: false,
  };
  const runtimeContext = runtimeContextFor(input, state);
  const executionInput = { ...input, context: runtimeContext };
  try {
    await writeAggregatePlanIfPresent(executionInput);
    await executionInput.beforeRun?.(executionInput.context);
    return await runChildrenForInput(executionInput);
  } catch (error: unknown) {
    state.primary = error;
    throw error;
  } finally {
    await cleanupRuntime({
      context: runtimeContext,
      state,
      ...(input.afterRun === undefined ? {} : { afterRun: input.afterRun }),
    });
  }
};
