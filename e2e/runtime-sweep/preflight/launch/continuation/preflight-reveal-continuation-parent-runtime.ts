import { zeroRevealOperationTotals } from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import { combineFailures } from "../bounded/preflight-detached-process-group.ts";
import { runChildUntilDone } from "../checkpoint/preflight-reveal-host-checkpoint-parent.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";

const initialParentProgress = (): ParentProgress => ({
  previousGrantDigest: null,
  previousCompletedCandidateCount: 0,
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
  operationHead: null,
  operationChunkCount: 0,
  operationTotals: zeroRevealOperationTotals(),
  previousCheckpointDigest: null,
  previousSampleSequence: null,
});

export const runRevealContinuationWithRuntime = async (input: {
  readonly context: ParentContext;
  readonly maxChildren: number;
  readonly runChildren?: typeof runChildUntilDone;
  readonly beforeRun?: (context: ParentContext) => Promise<void>;
  readonly afterRun?: (context: ParentContext) => Promise<void>;
}): Promise<number> => {
  const state: { primary?: unknown } = {};
  try {
    await input.beforeRun?.(input.context);
    return await (input.runChildren ?? runChildUntilDone)({
      context: input.context,
      progress: initialParentProgress(),
      ordinal: 0,
      maxChildren: input.maxChildren,
    });
  } catch (error: unknown) {
    state.primary = error;
    throw error;
  } finally {
    if (input.afterRun !== undefined) {
      try {
        await input.afterRun(input.context);
      } catch (cleanupError: unknown) {
        if (state.primary !== undefined)
          throw combineFailures("Reveal continuation runtime", state.primary, [
            cleanupError,
          ]);
        throw cleanupError;
      }
    }
  }
};
